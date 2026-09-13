import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  lifestyleChanges,
  lifestyleProfiles,
  type LifestyleChange,
  type LifestyleProfile,
  type NewLifestyleProfile,
} from "@/db/schema";

// The singleton variant of the state query layer. Differences from the
// Medication/Condition/Allergy shape, all downstream of "one row per patient,
// created lazily" (§4:515-539 + no §6.12 Add form):
//  - no create(): update() upserts (the unique index on patient_id is the
//    guard), and change-create upserts an empty row before logging against it
//  - trend fields pass through update() only while currently null — first
//    population is the create-form analog; afterwards they route through
//    lifestyleChangeQueries.create (the §4:538 trend story)
//  - changes are keyed by patient_id directly (no lifestyle_profile_id column
//    on lifestyle_changes per §4:534) — no inner-select scoping needed

// The §4:538 trend-story axes — the change-logged field set.
export const LIFESTYLE_TREND_FIELDS = [
  "dietPattern",
  "exercisePattern",
  "sleepPattern",
  "exerciseIntensity",
  "stressLevel",
  "tobaccoUse",
  "alcoholUse",
] as const;

export type LifestyleTrendField = (typeof LIFESTYLE_TREND_FIELDS)[number];

type LifestyleUpdate = Partial<
  Pick<
    NewLifestyleProfile,
    LifestyleTrendField | "dietRestrictions" | "stressContext" | "notes"
  >
>;

// Domain error kinds:
//  - field_locked     — PATCH touched a trend field that already has a value
//                       (meta.fields lists every offender so the response can
//                       teach all of them at once)
//  - value_unchanged  — change-log no-op (newValue === current value)
export class LifestyleDomainError extends Error {
  constructor(
    public readonly kind: "field_locked" | "value_unchanged",
    public readonly meta?: {
      fields?: string[];
      field?: string;
      currentValue?: string | null;
    },
  ) {
    super(kind);
    this.name = "LifestyleDomainError";
  }
}

export const lifestyleQueries = {
  async getForPatient(patientId: string): Promise<LifestyleProfile | undefined> {
    const rows = await db
      .select()
      .from(lifestyleProfiles)
      .where(eq(lifestyleProfiles.patientId, patientId))
      .limit(1);
    return rows[0];
  },

  // Upsert-update: creates the singleton row on first write. Trend fields are
  // accepted only while their current value is null (or when the incoming
  // value equals the current one — idempotent re-send); a populated trend
  // field must change via lifestyleChangeQueries.create.
  async update(
    patientId: string,
    values: LifestyleUpdate,
  ): Promise<LifestyleProfile> {
    return db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(lifestyleProfiles)
        .where(eq(lifestyleProfiles.patientId, patientId))
        .limit(1);

      if (current) {
        const locked = LIFESTYLE_TREND_FIELDS.filter((field) => {
          if (!(field in values)) return false;
          const existing = current[field];
          return existing != null && existing !== values[field];
        });
        if (locked.length > 0) {
          throw new LifestyleDomainError("field_locked", { fields: locked });
        }
        const [updated] = await tx
          .update(lifestyleProfiles)
          .set(values)
          .where(eq(lifestyleProfiles.id, current.id))
          .returning();
        return updated;
      }

      const [created] = await tx
        .insert(lifestyleProfiles)
        .values({ patientId, ...values })
        .returning();
      return created;
    });
  },
};

export const lifestyleChangeQueries = {
  // Sort by changedAt (the clinical day the change happened) with createdAt as
  // a tiebreaker — same contract as the other change tables.
  async forPatient(patientId: string): Promise<LifestyleChange[]> {
    return db
      .select()
      .from(lifestyleChanges)
      .where(eq(lifestyleChanges.patientId, patientId))
      .orderBy(
        desc(lifestyleChanges.changedAt),
        desc(lifestyleChanges.createdAt),
      );
  },

  // Transactional: read (or lazily create) the profile → validate → insert
  // change-log row → update the profile's field. Logging a change against a
  // not-yet-created profile is legal — the entry records `— → value` ("set
  // to"), and the upsert keeps the +Log-a-change path independent of whether
  // inline population happened first.
  //
  // No-op writes (newValue === current value) are rejected for every trend
  // field, not just a status — lifestyle has no status axis, and a junk
  // "moderate → moderate" row would pollute the trend story the change log
  // exists to tell (§4:538).
  async create(
    patientId: string,
    input: {
      field: LifestyleTrendField;
      newValue: string;
      reason?: string;
      changedAt?: Date;
      recordedBy: string;
    },
  ): Promise<{ change: LifestyleChange; profile: LifestyleProfile }> {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(lifestyleProfiles)
        .where(eq(lifestyleProfiles.patientId, patientId))
        .limit(1)
        .for("update");

      const current =
        existing ??
        (
          await tx
            .insert(lifestyleProfiles)
            .values({ patientId })
            .returning()
        )[0];

      const oldValue: string | null = current[input.field];

      if (oldValue === input.newValue) {
        throw new LifestyleDomainError("value_unchanged", {
          field: input.field,
          currentValue: oldValue,
        });
      }

      const [change] = await tx
        .insert(lifestyleChanges)
        .values({
          patientId,
          field: input.field,
          oldValue,
          newValue: input.newValue,
          reason: input.reason ?? null,
          recordedBy: input.recordedBy,
          ...(input.changedAt ? { changedAt: input.changedAt } : {}),
        })
        .returning();

      // The route parses input with createLifestyleChangeSchema before calling
      // here, so newValue is already constrained to the field's value-set —
      // the cast mirrors allergyChangeQueries.create's per-field patch.
      const patch = {
        [input.field]: input.newValue,
      } as Partial<NewLifestyleProfile>;

      const [updated] = await tx
        .update(lifestyleProfiles)
        .set(patch)
        .where(eq(lifestyleProfiles.id, current.id))
        .returning();

      return { change, profile: updated };
    });
  },
};
