import { z } from "zod";

import { familyHistoryRelation } from "@/db/schema";

/**
 * Zod schemas for /api/family-history routes. Clones lib/schemas/api/allergy.ts
 * minus everything change-log-shaped — FamilyHistory has NO paired changes
 * table (§4:558: entries are inline-edited in place; the edit trail isn't
 * clinically meaningful), so there is no change schema and no clinical-field
 * split: every column is plain PATCH-editable.
 *
 * No `patientId` in any body — auth-derived via getCurrentPatient() per the
 * 9.6:2755 tripwire.
 *
 * `ageOfOnset` is bounded 0-130 — wide enough for any real onset age, tight
 * enough to catch a year typed into the age box (e.g. 1965).
 */

const relationEnum = z.enum(familyHistoryRelation.enumValues);

const ageOfOnsetSchema = z
  .number()
  .int()
  .min(0, "Age can't be negative")
  .max(130, "That looks like a year, not an age");

export const createFamilyHistorySchema = z
  .object({
    relation: relationEnum,
    relationSpecific: z.string().min(1).optional(),
    conditionName: z.string().min(1),
    ageOfOnset: ageOfOnsetSchema.optional(),
    outcome: z.string().min(1).optional(),
    notes: z.string().optional(),
  })
  .strict();

export const updateFamilyHistorySchema = z
  .object({
    // Non-nullable: the column is NOT NULL. Re-assigning the relation is
    // allowed; clearing it is not.
    relation: relationEnum.optional(),
    relationSpecific: z.string().min(1).nullable().optional(),
    conditionName: z.string().min(1).optional(),
    ageOfOnset: ageOfOnsetSchema.nullable().optional(),
    outcome: z.string().min(1).nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

export type CreateFamilyHistoryInput = z.infer<
  typeof createFamilyHistorySchema
>;
export type UpdateFamilyHistoryInput = z.infer<
  typeof updateFamilyHistorySchema
>;