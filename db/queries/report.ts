import { and, desc, eq, isNotNull, notExists, or } from "drizzle-orm";

import { db } from "@/db";
import {
  conditions,
  extractionSessions,
  journalEntries,
  labReports,
  medications,
  reports,
  symptomEpisodes,
  visits,
  vitalReadings,
  type Condition,
  type Medication,
  type NewReport,
  type Report,
} from "@/db/schema";
import { formatISODate } from "@/lib/agents/_shared/serializers/format";
import { doctorInScope, visitInScope } from "./_shared";

// Non-FK + FK columns editable via PATCH. No change-log split — Report is an
// event entity (§6.7: no History; Edit corrects the row in place). The two
// linked FKs (visit / doctor) are scope-checked before any write.
type ReportUpdate = Partial<
  Pick<
    NewReport,
    | "title"
    | "reportDate"
    | "reportType"
    | "linkedVisitId"
    | "linkedDoctorId"
    | "content"
    | "notes"
  >
>;

// Domain error kinds:
//  - not_found             — patient-scoped lookup missed
//  - linked_entity_invalid — linkedVisitId / linkedDoctorId out of patient scope
//                            (reason "visit_not_found" / "doctor_not_found")
export class ReportDomainError extends Error {
  constructor(
    public readonly kind: "not_found" | "linked_entity_invalid",
    public readonly meta?: { field?: string; reason?: string },
  ) {
    super(kind);
    this.name = "ReportDomainError";
  }
}

/**
 * Entities surfaced FROM a report — the §6.7 Outcomes section ("extracted
 * entities (medications, conditions surfaced from the report)"). Each derived
 * entity carries `source_report_id` back to its report (Phase 9.4 file-to-entity
 * linking). Populated by the Phase E extraction pipeline; empty for
 * manually-entered reports until then.
 */
export interface ReportOutcomes {
  medications: Medication[];
  conditions: Condition[];
}

// Validates both optional linked FKs are in patient scope before a write. Maps
// to a 400 (not a Postgres FK-violation 500); a report can't reference another
// patient's visit or doctor.
async function assertLinkedRefsInScope(
  patientId: string,
  linkedVisitId: string | null | undefined,
  linkedDoctorId: string | null | undefined,
): Promise<void> {
  if (linkedVisitId && !(await visitInScope(patientId, linkedVisitId))) {
    throw new ReportDomainError("linked_entity_invalid", {
      field: "linkedVisitId",
      reason: "visit_not_found",
    });
  }
  if (linkedDoctorId && !(await doctorInScope(patientId, linkedDoctorId))) {
    throw new ReportDomainError("linked_entity_invalid", {
      field: "linkedDoctorId",
      reason: "doctor_not_found",
    });
  }
}

// A quick-log stub is REDUNDANT — and so hidden — only once it has produced a
// source-linked entity: the medication/condition/etc. is the user-facing record,
// the note is just its raw source. An entity-LESS stub (extraction failed, or
// the whole confirmation was discarded) is NOT redundant with anything — hiding
// it too would silently lose the note the user typed. So it stays visible.
// `source_report_id` lives on 7 entity types (doctors + allergies don't carry
// it); this is true iff NONE of them references the report.
function hasNoSourceLinkedEntity() {
  return and(
    notExists(
      db
        .select({ one: medications.id })
        .from(medications)
        .where(eq(medications.sourceReportId, reports.id)),
    ),
    notExists(
      db
        .select({ one: conditions.id })
        .from(conditions)
        .where(eq(conditions.sourceReportId, reports.id)),
    ),
    notExists(
      db
        .select({ one: labReports.id })
        .from(labReports)
        .where(eq(labReports.sourceReportId, reports.id)),
    ),
    notExists(
      db
        .select({ one: vitalReadings.id })
        .from(vitalReadings)
        .where(eq(vitalReadings.sourceReportId, reports.id)),
    ),
    notExists(
      db
        .select({ one: symptomEpisodes.id })
        .from(symptomEpisodes)
        .where(eq(symptomEpisodes.sourceReportId, reports.id)),
    ),
    notExists(
      db
        .select({ one: visits.id })
        .from(visits)
        .where(eq(visits.sourceReportId, reports.id)),
    ),
    notExists(
      db
        .select({ one: journalEntries.id })
        .from(journalEntries)
        .where(eq(journalEntries.sourceReportId, reports.id)),
    ),
  );
}

/**
 * Shared WHERE for "real" reports — excludes the quick-log source stubs the
 * quick-log path creates to hold typed text (§5.4), but ONLY once a stub has
 * produced a source-linked entity (then the entity is the user-facing record and
 * the note is redundant). A stub has an extraction_session AND no source_file_url;
 * an uploaded document (has a file), a manually-entered report (no
 * extraction_session), and an entity-LESS stub (failed/discarded — nothing
 * references it, so its note would otherwise vanish) all qualify as real. Used by
 * BOTH the §6.6 timeline (`forTimeline`) and the wiki-rail count (`wikiCounts`)
 * so the list and its badge count can never drift.
 */
export function realReportsWhere(patientId: string) {
  return and(
    eq(reports.patientId, patientId),
    or(
      isNotNull(reports.sourceFileUrl),
      notExists(
        db
          .select({ one: extractionSessions.id })
          .from(extractionSessions)
          .where(eq(extractionSessions.reportId, reports.id)),
      ),
      hasNoSourceLinkedEntity(),
    ),
  );
}

export const reportQueries = {
  // reportDate desc with createdAt tiebreaker — two same-day reports render in
  // reverse write order, matching the timeline convention.
  async forPatient(patientId: string): Promise<Report[]> {
    return db
      .select()
      .from(reports)
      .where(eq(reports.patientId, patientId))
      .orderBy(desc(reports.reportDate), desc(reports.createdAt));
  },

  // The §6.6 Reports TIMELINE — real documents only. Excludes the placeholder
  // Reports the quick-log path creates to hold typed source text (§5.4): those
  // exist purely as the extraction source + `source_report_id` target, and a
  // note like "He stopped taking Glimepiride" isn't a user-facing report. A stub
  // is identified structurally — it has an extraction_session AND no source file
  // — so an uploaded document (has a file) and a manually-entered report (has no
  // extraction_session) both stay visible. Stubs remain fetchable by id, so any
  // entity's source link still resolves to its note; they're just off the list.
  async forTimeline(patientId: string): Promise<Report[]> {
    return db
      .select()
      .from(reports)
      .where(realReportsWhere(patientId))
      .orderBy(desc(reports.reportDate), desc(reports.createdAt));
  },

  // Backs the §6.6 `All types ▾` filter.
  async byType(
    patientId: string,
    type: NonNullable<Report["reportType"]>,
  ): Promise<Report[]> {
    return db
      .select()
      .from(reports)
      .where(
        and(eq(reports.patientId, patientId), eq(reports.reportType, type)),
      )
      .orderBy(desc(reports.reportDate), desc(reports.createdAt));
  },

  async getById(patientId: string, id: string): Promise<Report | null> {
    const rows = await db
      .select()
      .from(reports)
      .where(and(eq(reports.id, id), eq(reports.patientId, patientId)))
      .limit(1);
    return rows[0] ?? null;
  },

  // Resolves a citation-pill slug back to a report. The serializer's reportSlug
  // is the ISO report date (`report:2026-04-12`), so the bare slug IS the date —
  // matched by construction-round-trip like the other bySlug helpers, with the
  // same collision-suffix limitation (a second same-day report cites as
  // `report:2026-04-12-2`, which resolves to null; accepted for v1).
  async bySlug(patientId: string, slug: string): Promise<Report | null> {
    const rows = await reportQueries.forPatient(patientId);
    return rows.find((r) => formatISODate(r.reportDate) === slug) ?? null;
  },

  async create(values: NewReport): Promise<Report> {
    await assertLinkedRefsInScope(
      values.patientId,
      values.linkedVisitId,
      values.linkedDoctorId,
    );
    const [row] = await db.insert(reports).values(values).returning();
    return row;
  },

  async update(
    patientId: string,
    id: string,
    values: ReportUpdate,
  ): Promise<Report | null> {
    await assertLinkedRefsInScope(
      patientId,
      values.linkedVisitId,
      values.linkedDoctorId,
    );
    const [row] = await db
      .update(reports)
      .set(values)
      .where(and(eq(reports.id, id), eq(reports.patientId, patientId)))
      .returning();
    return row ?? null;
  },

  // Derived entities (meds / conditions) carry source_report_id with
  // onDelete:"set null" — deleting a report detaches its outcomes but never
  // deletes them.
  async delete(patientId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(reports)
      .where(and(eq(reports.id, id), eq(reports.patientId, patientId)))
      .returning({ id: reports.id });
    return result.length > 0;
  },

  // §6.7 Outcomes — medications + conditions extracted from this report. Scope
  // rides each entity's own patient_id, so a foreign reportId can't surface
  // another patient's rows. Empty until the Phase E extraction pipeline writes
  // source_report_id.
  async outcomesForReport(
    patientId: string,
    reportId: string,
  ): Promise<ReportOutcomes> {
    const [meds, conds] = await Promise.all([
      db
        .select()
        .from(medications)
        .where(
          and(
            eq(medications.patientId, patientId),
            eq(medications.sourceReportId, reportId),
          ),
        )
        .orderBy(desc(medications.createdAt)),
      db
        .select()
        .from(conditions)
        .where(
          and(
            eq(conditions.patientId, patientId),
            eq(conditions.sourceReportId, reportId),
          ),
        )
        .orderBy(desc(conditions.createdAt)),
    ]);
    return { medications: meds, conditions: conds };
  },
};
