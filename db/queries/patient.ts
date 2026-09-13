import { and, count, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  allergies,
  conditions,
  doctors,
  familyHistory,
  insights,
  lifestyleProfiles,
  medications,
  patients,
  visits,
  type Patient,
} from "@/db/schema";
import { displayDoctorName } from "@/lib/doctor-display";

// Columns the patient profile lets the user inline-edit (design.md 6.10:1702).
// No clinical-event semantics here — the patient root has no change log — so a
// plain partial update is correct (contrast with the state entities' guarded
// PATCH). The PATCH route's Zod schema is the gate on which keys arrive.
export type PatientUpdate = Partial<
  Pick<
    Patient,
    | "name"
    | "preferredName"
    | "sex"
    | "dateOfBirth"
    | "bloodType"
    | "heightCm"
    | "currentWeightKg"
    | "city"
    | "country"
    | "notes"
  >
>;

// One AT A GLANCE row that names a few of its items (design.md 6.10:1680 +
// the §6.5 "light context" the link list carries): a total count plus up to
// PREVIEW_LIMIT sample names, most-recent first.
export interface GlancePreview {
  count: number;
  names: string[];
}

// AT A GLANCE meta-summary (design.md 6.10:1680). Entity rows carry a few
// sample names (enriched "light context" per §6.5, user decision 2026-06-18);
// the recency/singleton rows stay plain counts. Allergies is NOT here — it
// lives in MEDICAL PROFILE (the duplication §6.10 spec'd was dropped there).
export interface PatientAtAGlance {
  conditions: GlancePreview;
  medications: GlancePreview;
  doctors: GlancePreview;
  familyHistory: GlancePreview;
  activeAllergies: number;
  lifestyleUpdatedAt: Date | null;
  recentVisits: number;
  newInsights: number;
}

const PREVIEW_LIMIT = 2;

// `COUNT(*) OVER()` rides alongside the LIMITed preview rows: every returned
// row carries the total count of the full filtered set (computed before LIMIT),
// so one query yields both the count and the sample names. postgres-js returns
// the bigint as a string — mapWith(Number) coerces it.
const totalOver = sql<number>`count(*) over()`.mapWith(Number);

async function countRows(table: PgTable, where: SQL | undefined): Promise<number> {
  const [row] = await db.select({ n: count() }).from(table).where(where);
  return row?.n ?? 0;
}

// "aunt_uncle" → "Aunt/uncle", "parent" → "Parent". The relation enum is the
// fallback label when relationSpecific is unset; this matches the cased,
// free-text relationSpecific it stands in for.
function relationLabel(relation: string): string {
  const spaced = relation.replace(/_/g, "/");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export const patientQueries = {
  async getById(patientId: string): Promise<Patient | undefined> {
    const rows = await db
      .select()
      .from(patients)
      .where(eq(patients.id, patientId))
      .limit(1);
    return rows[0];
  },

  async update(
    patientId: string,
    values: PatientUpdate,
  ): Promise<Patient | undefined> {
    const [updated] = await db
      .update(patients)
      .set(values)
      .where(eq(patients.id, patientId))
      .returning();
    return updated;
  },

  /*
   * AT A GLANCE data — one parallel wave of independent queries (no sequential
   * round-trips). Each of the four entity rows is a single query: a LIMITed
   * most-recent-first preview whose rows also carry COUNT(*) OVER() as the full
   * total (see totalOver), so count + sample names come back together.
   * Allergies/visits/insights are plain COUNT(*); lifestyle is its updated-at.
   *
   * "Recent visits" is the inclusive window [since, today] so future scheduled
   * visits don't leak into a "last 30 days" count; both bounds are
   * caller-supplied date strings (patient-timezone resolved). "New insights"
   * counts status='new' only — generation lands in Phase E, so it reads 0.
   */
  async atAGlance(
    patientId: string,
    visitsSince: string,
    today: string,
  ): Promise<PatientAtAGlance> {
    const [
      condRows,
      medRows,
      doctorRows,
      familyRows,
      activeAllergies,
      recentVisits,
      newInsights,
      lifestyleRow,
    ] = await Promise.all([
      db
        .select({ name: conditions.name, total: totalOver })
        .from(conditions)
        .where(
          and(eq(conditions.patientId, patientId), eq(conditions.status, "active")),
        )
        .orderBy(desc(conditions.createdAt))
        .limit(PREVIEW_LIMIT),
      db
        .select({ name: medications.name, total: totalOver })
        .from(medications)
        .where(
          and(eq(medications.patientId, patientId), eq(medications.status, "active")),
        )
        .orderBy(desc(medications.createdAt))
        .limit(PREVIEW_LIMIT),
      db
        .select({
          name: doctors.name,
          specialty: doctors.specialty,
          total: totalOver,
        })
        .from(doctors)
        .where(eq(doctors.patientId, patientId))
        .orderBy(desc(doctors.createdAt))
        .limit(PREVIEW_LIMIT),
      db
        .select({
          conditionName: familyHistory.conditionName,
          relationSpecific: familyHistory.relationSpecific,
          relation: familyHistory.relation,
          total: totalOver,
        })
        .from(familyHistory)
        .where(eq(familyHistory.patientId, patientId))
        .orderBy(desc(familyHistory.createdAt))
        .limit(PREVIEW_LIMIT),
      countRows(
        allergies,
        and(eq(allergies.patientId, patientId), eq(allergies.status, "active")),
      ),
      countRows(
        visits,
        and(
          eq(visits.patientId, patientId),
          // Cancelled / no-show visits never happened — not recent activity.
          eq(visits.status, "completed"),
          gte(visits.visitDate, visitsSince),
          lte(visits.visitDate, today),
        ),
      ),
      countRows(
        insights,
        and(eq(insights.patientId, patientId), eq(insights.status, "new")),
      ),
      db
        .select({ updatedAt: lifestyleProfiles.updatedAt })
        .from(lifestyleProfiles)
        .where(eq(lifestyleProfiles.patientId, patientId))
        .limit(1),
    ]);

    return {
      conditions: {
        count: condRows[0]?.total ?? 0,
        names: condRows.map((r) => r.name),
      },
      medications: {
        count: medRows[0]?.total ?? 0,
        names: medRows.map((r) => r.name),
      },
      doctors: {
        count: doctorRows[0]?.total ?? 0,
        names: doctorRows.map(
          (r) => `${displayDoctorName(r.name)} · ${r.specialty}`,
        ),
      },
      familyHistory: {
        count: familyRows[0]?.total ?? 0,
        names: familyRows.map(
          (r) => `${r.relationSpecific ?? relationLabel(r.relation)} · ${r.conditionName}`,
        ),
      },
      activeAllergies,
      lifestyleUpdatedAt: lifestyleRow[0]?.updatedAt ?? null,
      recentVisits,
      newInsights,
    };
  },
};
