import { and, desc, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import {
  labReports,
  medicationChanges,
  medications,
  reports,
  symptomEpisodes,
  symptomTypes,
  visits,
  type LabReport,
  type MedicationChange,
  type NewVisit,
  type Report,
  type SymptomEpisode,
  type Visit,
} from "@/db/schema";
import { formatISODate } from "@/lib/agents/_shared/serializers/format";
import { doctorInScope } from "./_shared";

// Non-FK columns editable via PATCH alongside the scope-checked doctorId. No
// change-log split — Visit is an event entity (§6.7: no History; Edit corrects
// the row in place).
type VisitUpdate = Partial<
  Pick<
    NewVisit,
    | "doctorId"
    | "visitDate"
    | "visitType"
    | "chiefComplaint"
    | "summary"
    | "diagnosisText"
    | "nextSteps"
    | "status"
    | "notes"
  >
>;

// Domain error kinds:
//  - not_found             — patient-scoped lookup missed
//  - linked_entity_invalid — doctorId out of patient scope
//                            (reason "doctor_not_found")
export class VisitDomainError extends Error {
  constructor(
    public readonly kind: "not_found" | "linked_entity_invalid",
    public readonly meta?: { field?: string; reason?: string },
  ) {
    super(kind);
    this.name = "VisitDomainError";
  }
}

/**
 * A medication change that came out of a visit, denormalized with the parent
 * medication's identity for badge / outcome-row rendering
 * ("↑ Amlodipine · dose 5 mg → 10 mg").
 */
export interface VisitMedChange {
  change: MedicationChange;
  medicationId: string;
  medicationName: string;
}

/**
 * Everything that links back to a visit via linked_visit_id — the §6.7
 * Outcomes section ("what came out of this visit") and the §6.6 result badges
 * are both rendered from these backlinks (Phase 4 Visit note: visits don't
 * *contain* prescriptions or lab orders, they *produce* them).
 */
export interface VisitOutcomes {
  medChanges: VisitMedChange[];
  labReports: LabReport[];
  reports: Report[];
}

/** A symptom episode forward-linked to a visit, with its type's name. */
export interface VisitLinkedEpisode {
  episode: SymptomEpisode;
  symptomTypeName: string;
}

// Patient scope on backlink queries rides the parent table's patient_id
// (medications / lab_reports / reports are all patient-scoped), so a foreign
// visitId can never surface another patient's rows.
async function medChangesByVisit(
  patientId: string,
  visitId?: string,
): Promise<VisitMedChange[]> {
  const rows = await db
    .select({
      change: medicationChanges,
      medicationId: medications.id,
      medicationName: medications.name,
    })
    .from(medicationChanges)
    .innerJoin(medications, eq(medicationChanges.medicationId, medications.id))
    .where(
      and(
        eq(medications.patientId, patientId),
        visitId
          ? eq(medicationChanges.linkedVisitId, visitId)
          : isNotNull(medicationChanges.linkedVisitId),
      ),
    )
    .orderBy(desc(medicationChanges.changedAt), desc(medicationChanges.createdAt));
  return rows;
}

async function labReportsByVisit(
  patientId: string,
  visitId?: string,
): Promise<LabReport[]> {
  return db
    .select()
    .from(labReports)
    .where(
      and(
        eq(labReports.patientId, patientId),
        visitId
          ? eq(labReports.linkedVisitId, visitId)
          : isNotNull(labReports.linkedVisitId),
      ),
    )
    .orderBy(desc(labReports.reportDate));
}

async function reportsByVisit(
  patientId: string,
  visitId?: string,
): Promise<Report[]> {
  return db
    .select()
    .from(reports)
    .where(
      and(
        eq(reports.patientId, patientId),
        visitId
          ? eq(reports.linkedVisitId, visitId)
          : isNotNull(reports.linkedVisitId),
      ),
    )
    .orderBy(desc(reports.reportDate));
}

export const visitQueries = {
  // visitDate desc with createdAt tiebreaker — two same-day visits render in
  // reverse write order, matching the change-log convention.
  async forPatient(patientId: string): Promise<Visit[]> {
    return db
      .select()
      .from(visits)
      .where(eq(visits.patientId, patientId))
      .orderBy(desc(visits.visitDate), desc(visits.createdAt));
  },

  // Backs the §6.6 `All doctors ▾` filter.
  async byDoctor(patientId: string, doctorId: string): Promise<Visit[]> {
    return db
      .select()
      .from(visits)
      .where(
        and(eq(visits.patientId, patientId), eq(visits.doctorId, doctorId)),
      )
      .orderBy(desc(visits.visitDate), desc(visits.createdAt));
  },

  async getById(patientId: string, id: string): Promise<Visit | null> {
    const rows = await db
      .select()
      .from(visits)
      .where(and(eq(visits.id, id), eq(visits.patientId, patientId)))
      .limit(1);
    return rows[0] ?? null;
  },

  // Resolves a citation-pill slug back to a visit. The serializer's visitSlug
  // is the ISO visit date (`visit:2026-04-30`), so the bare slug IS the date —
  // matched by construction-round-trip like the other bySlug helpers, with the
  // same collision-suffix limitation (a second same-day visit cites as
  // `visit:2026-04-30-2`, which resolves to null; accepted for v1).
  async bySlug(patientId: string, slug: string): Promise<Visit | null> {
    const rows = await visitQueries.forPatient(patientId);
    return rows.find((v) => formatISODate(v.visitDate) === slug) ?? null;
  },

  // Validates the doctorId FK target is in patient scope before insert (mapped
  // 400, not a Postgres FK-violation 500; can't reference another patient's
  // doctor).
  async create(values: NewVisit): Promise<Visit> {
    if (!(await doctorInScope(values.patientId, values.doctorId))) {
      throw new VisitDomainError("linked_entity_invalid", {
        field: "doctorId",
        reason: "doctor_not_found",
      });
    }
    const [row] = await db.insert(visits).values(values).returning();
    return row;
  },

  async update(
    patientId: string,
    id: string,
    values: VisitUpdate,
  ): Promise<Visit | null> {
    if (values.doctorId && !(await doctorInScope(patientId, values.doctorId))) {
      throw new VisitDomainError("linked_entity_invalid", {
        field: "doctorId",
        reason: "doctor_not_found",
      });
    }
    const [row] = await db
      .update(visits)
      .set(values)
      .where(and(eq(visits.id, id), eq(visits.patientId, patientId)))
      .returning();
    return row ?? null;
  },

  // Backlinks (med changes, lab reports, reports, symptom episodes) all carry
  // onDelete:"set null" on linked_visit_id — deleting a visit detaches its
  // outcomes but never deletes them.
  async delete(patientId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(visits)
      .where(and(eq(visits.id, id), eq(visits.patientId, patientId)))
      .returning({ id: visits.id });
    return result.length > 0;
  },

  // Outcomes for ONE visit — the §6.7 Outcomes section.
  async outcomesForVisit(
    patientId: string,
    visitId: string,
  ): Promise<VisitOutcomes> {
    const [medChanges, labs, reps] = await Promise.all([
      medChangesByVisit(patientId, visitId),
      labReportsByVisit(patientId, visitId),
      reportsByVisit(patientId, visitId),
    ]);
    return { medChanges, labReports: labs, reports: reps };
  },

  // Outcomes across ALL visits, for the §6.6 timeline's result badges — one
  // fetch, grouped by visit in the page (v1 scale: one patient's history).
  async outcomesForPatient(patientId: string): Promise<VisitOutcomes> {
    const [medChanges, labs, reps] = await Promise.all([
      medChangesByVisit(patientId),
      labReportsByVisit(patientId),
      reportsByVisit(patientId),
    ]);
    return { medChanges, labReports: labs, reports: reps };
  },

  // Symptom episodes FK-linked to a visit — §6.7 Linked context (temporal
  // forward-links). Scoped via the episode's own patient_id.
  async linkedEpisodesForVisit(
    patientId: string,
    visitId: string,
  ): Promise<VisitLinkedEpisode[]> {
    const rows = await db
      .select({
        episode: symptomEpisodes,
        symptomTypeName: symptomTypes.name,
      })
      .from(symptomEpisodes)
      .innerJoin(
        symptomTypes,
        eq(symptomEpisodes.symptomTypeId, symptomTypes.id),
      )
      .where(
        and(
          eq(symptomEpisodes.patientId, patientId),
          eq(symptomEpisodes.linkedVisitId, visitId),
        ),
      )
      .orderBy(desc(symptomEpisodes.startedAt));
    return rows;
  },
};
