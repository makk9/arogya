import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  symptomEpisodes,
  vitalReadings,
  type NewVitalReading,
  type VitalReading,
} from "@/db/schema";
import { symptomEpisodeInScope } from "./_shared";

/*
 * VitalReading queries — an EVENT entity with a reduced surface. No detail
 * page or rail item by design (§3:145 "the trend is the value"); readings
 * surface on the dashboard's key-markers card and the grouped vitals history
 * view (E0a), which entity links anchor into (`/vitals#r-<id>`). There's no
 * bySlug resolver and no update/correction (readings are immutable; a mistake
 * is deleted and re-entered, §4:433).
 *
 * Patient scope rides patient_id, so a foreign id can never surface another
 * patient's rows. `linkedSymptomId` is scope-checked before insert (a mapped
 * 400, not a Postgres FK-violation 500) like every cross-entity ref.
 */

// Domain error kinds:
//  - not_found             — patient-scoped lookup missed
//  - linked_entity_invalid — linkedSymptomId out of patient scope
//                            (reason "symptom_episode_not_found")
export class VitalDomainError extends Error {
  constructor(
    public readonly kind: "not_found" | "linked_entity_invalid",
    public readonly meta?: { field?: string; reason?: string },
  ) {
    super(kind);
    this.name = "VitalDomainError";
  }
}

export const vitalQueries = {
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
