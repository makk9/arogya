import { z } from "zod";

import {
  lifestyleAlcoholUse,
  lifestyleExerciseIntensity,
  lifestyleStressLevel,
  lifestyleTobaccoUse,
} from "@/db/schema";
import { isCalendarDate } from "@/lib/datetime";

/**
 * Zod schemas for /api/lifestyle routes. The singleton variant of the state
 * pattern — no create schema (the row is upserted lazily; §6.12 defines no
 * "Add lifestyle" form, the profile is onboarding-populated in Phase E and
 * inline-populated until then) and no id params anywhere.
 *
 * No `patientId` in any body — auth-derived via getCurrentPatient() per the
 * 9.6:2755 tripwire.
 *
 * Field split (Phase D call, decisions.md 2026-06-10): the seven TREND fields
 * (dietPattern / exercisePattern / sleepPattern / exerciseIntensity /
 * stressLevel / tobaccoUse / alcoholUse) are the §4:538 trend-story axes —
 * change-logged once populated. dietRestrictions / stressContext / notes are
 * plain PATCH-editable companions. PATCH accepts trend fields too, but the
 * query layer only lets them through while the current value is null (first
 * population — the create-form analog); after that they 400 with per-field
 * guidance toward POST /api/lifestyle/changes.
 */

const exerciseIntensityEnum = z.enum(lifestyleExerciseIntensity.enumValues);
const stressLevelEnum = z.enum(lifestyleStressLevel.enumValues);
const tobaccoUseEnum = z.enum(lifestyleTobaccoUse.enumValues);
const alcoholUseEnum = z.enum(lifestyleAlcoholUse.enumValues);

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .refine(isCalendarDate, "Not a real calendar date");

export const updateLifestyleSchema = z
  .object({
    // Trend fields: non-nullable — clearing a populated trend field would be a
    // change (locked anyway), and clearing an empty one is meaningless.
    dietPattern: z.string().min(1).optional(),
    exercisePattern: z.string().min(1).optional(),
    sleepPattern: z.string().min(1).optional(),
    exerciseIntensity: exerciseIntensityEnum.optional(),
    stressLevel: stressLevelEnum.optional(),
    tobaccoUse: tobaccoUseEnum.optional(),
    alcoholUse: alcoholUseEnum.optional(),
    // Companion fields: plain-editable, clearable.
    dietRestrictions: z.array(z.string().min(1)).nullable().optional(),
    stressContext: z.string().min(1).nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

// Discriminated union on `field` — the three narrative patterns take free
// text; the four enums are constrained to their pgEnum value-sets. Shared base
// (reason / changedAt) sits in lifestyleChangeBase. lifestyle_changes.field is
// a plain text column, so this union is the sole guard on what gets written
// (same situation as allergy_changes).
const lifestyleChangeBase = z.object({
  reason: z.string().min(1).optional(),
  changedAt: dateOnlySchema.optional(),
});

export const createLifestyleChangeSchema = z.discriminatedUnion("field", [
  lifestyleChangeBase.extend({
    field: z.literal("dietPattern"),
    newValue: z.string().min(1),
  }),
  lifestyleChangeBase.extend({
    field: z.literal("exercisePattern"),
    newValue: z.string().min(1),
  }),
  lifestyleChangeBase.extend({
    field: z.literal("sleepPattern"),
    newValue: z.string().min(1),
  }),
  lifestyleChangeBase.extend({
    field: z.literal("exerciseIntensity"),
    newValue: exerciseIntensityEnum,
  }),
  lifestyleChangeBase.extend({
    field: z.literal("stressLevel"),
    newValue: stressLevelEnum,
  }),
  lifestyleChangeBase.extend({
    field: z.literal("tobaccoUse"),
    newValue: tobaccoUseEnum,
  }),
  lifestyleChangeBase.extend({
    field: z.literal("alcoholUse"),
    newValue: alcoholUseEnum,
  }),
]);

export type UpdateLifestyleInput = z.infer<typeof updateLifestyleSchema>;
export type CreateLifestyleChangeInput = z.infer<
  typeof createLifestyleChangeSchema
>;
