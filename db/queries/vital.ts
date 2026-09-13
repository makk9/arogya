import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  symptomEpisodes,
  vitalReadings,
  type NewVitalReading,
  type VitalReading,
} from "@/db/schema";
import { symptomEpisodeInScope } from "./_shared";
import { READING_TYPE_ORDER, type VitalReadingTypeValue } from "@/lib/vitals";

/*
 * VitalReading queries — an EVENT entity with a reduced surface. No detail
 * page ("the trend is the value", §3:145); readings surface on the dashboard's
 * key-markers card and the grouped vitals history view (E0a — a rail item
 * since the 2026-08-12 promotion), which entity links anchor into
 * (`/vitals#r-<id>`). There's no bySlug resolver. Readings are corrected in
 * place via `update` (no change log, like a lab marker correction —
 * decisions.md 2026-09-13 supersedes §4:433's delete-and-re-enter rule).
 *
 * Patient scope rides patient_id, so a foreign id can never surface another
 * patient's rows. `linkedSymptomId` is scope-checked before insert (a mapped
 * 400, not a Postgres FK-violation 500) like every cross-entity ref.
 */

// Domain error kinds:
//  - not_found             — patient-scoped lookup missed
//  - linked_entity_invalid — linkedSymptomId out of patient scope
//                            (reason "symptom_episode_not_found")
//  - secondary_not_allowed — a second value on a single-number reading type
export class VitalDomainError extends Error {
  constructor(
    public readonly kind: "not_found" | "linked_entity_invalid" | "secondary_not_allowed",
    public readonly meta?: { field?: string; reason?: string },
  ) {
    super(kind);
    this.name = "VitalDomainError";
  }
}

export const vitalQueries = {
  // Which vital types have data, with per-type counts, in the canonical
  // display order — the AT A GLANCE row's shape. Grouped aggregate instead of
  // fetching every reading to derive type presence (that stops scaling the
  // moment readings do). READING_TYPE_ORDER lives in lib/vitals precisely so
  // the DB layer can compose canonical vitals ordering (E0a).
  async typeCounts(
    patientId: string,
  ): Promise<Array<{ readingType: VitalReadingTypeValue; count: number }>> {
    const rows = await db
      .select({
        readingType: vitalReadings.readingType,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(vitalReadings)
      .where(eq(vitalReadings.patientId, patientId))
      .groupBy(vitalReadings.readingType);
    const order = new Map(READING_TYPE_ORDER.map((t, i) => [t, i]));
    return rows.sort(
      (a, b) =>
        (order.get(a.readingType) ?? 99) - (order.get(b.readingType) ?? 99),
    );
  },

  async forPatient(patientId: string): Promise<VitalReading[]> {
    return db
      .select()
      .from(vitalReadings)
      .where(eq(vitalReadings.patientId, patientId))
      .orderBy(desc(vitalReadings.recordedAt));
  },

  async getById(patientId: string, id: string): Promise<VitalReading | null> {
    const rows = await db
      .select()
      .from(vitalReadings)
      .where(and(eq(vitalReadings.id, id), eq(vitalReadings.patientId, patientId)))
      .limit(1);
    return rows[0] ?? null;
  },

  // Resolves a set of reading ids in one query, patient-scoped — backs the
  // symptom episode's `linked_vital_ids` rendering (the `●` pills on cards +
  // the "Captured at this episode" rows on the detail page). Returns recorded
  // order so the rendered pills are chronological.
  async byIds(patientId: string, ids: readonly string[]): Promise<VitalReading[]> {
    if (ids.length === 0) return [];
    return db
      .select()
      .from(vitalReadings)
      .where(
        and(eq(vitalReadings.patientId, patientId), inArray(vitalReadings.id, [...ids])),
      )
      .orderBy(desc(vitalReadings.recordedAt));
  },

  async create(values: NewVitalReading): Promise<VitalReading> {
    if (
      values.linkedSymptomId &&
      !(await symptomEpisodeInScope(values.patientId, values.linkedSymptomId))
    ) {
      throw new VitalDomainError("linked_entity_invalid", {
        field: "linkedSymptomId",
        reason: "symptom_episode_not_found",
      });
    }
    const [row] = await db.insert(vitalReadings).values(values).returning();
    return row;
  },

  // In-place correction. readingType is immutable (not in the update shape),
  // so a secondary value is only accepted where the stored type carries one
  // (blood pressure). Returns null when the reading isn't this patient's.
  async update(
    patientId: string,
    id: string,
    values: Partial<
      Pick<
        NewVitalReading,
        | "recordedAt"
        | "valuePrimary"
        | "valueSecondary"
        | "unit"
        | "context"
        | "flag"
        | "notes"
      >
    >,
  ): Promise<VitalReading | null> {
    return db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(vitalReadings)
        .where(and(eq(vitalReadings.id, id), eq(vitalReadings.patientId, patientId)))
        .limit(1)
        .for("update");
      if (!current) return null;
      if (values.valueSecondary && current.readingType !== "blood_pressure") {
        throw new VitalDomainError("secondary_not_allowed", {
          field: "valueSecondary",
        });
      }
      const [row] = await tx
        .update(vitalReadings)
        .set(values)
        .where(eq(vitalReadings.id, id))
        .returning();
      return row;
    });
  },

  async delete(patientId: string, id: string): Promise<boolean> {
    return db.transaction(async (tx) => {
      // Scrub this reading from any episode's linked_vital_ids (a uuid[], NOT an
      // FK) before deleting it — otherwise the deleted id lingers as a dangling
      // reference that the symptom serializer emits as "§ unresolved:<id>" in the
      // vault context, silently breaking the episode↔reading link the demo
      // relies on. Patient-scoped; rows without the id are untouched.
      await tx
        .update(symptomEpisodes)
        .set({
          linkedVitalIds: sql`array_remove(${symptomEpisodes.linkedVitalIds}, ${id}::uuid)`,
        })
        .where(
          and(
            eq(symptomEpisodes.patientId, patientId),
            sql`${id}::uuid = ANY(${symptomEpisodes.linkedVitalIds})`,
          ),
        );
      const result = await tx
        .delete(vitalReadings)
        .where(
          and(eq(vitalReadings.id, id), eq(vitalReadings.patientId, patientId)),
        )
        .returning({ id: vitalReadings.id });
      return result.length > 0;
    });
  },
};
