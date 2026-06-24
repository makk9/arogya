import { z } from "zod";

import { bloodType, sex } from "@/db/schema";

/**
 * Zod schema for PATCH /api/patient per design.md 9.6:2776 + the 6.10 patient
 * profile (inline-edited identity / medical-profile / notes fields).
 *
 * No `patientId` in the body — auth-derived via getCurrentPatient() per the
 * 9.6:2755 tripwire (the patient root is a singleton for the current account).
 *
 * The patient root has no change log, so — unlike the state entities — every
 * editable field updates in place with no clinical-event guard. Required
 * columns (name / sex / dateOfBirth / country) are `.optional()` (a partial
 * PATCH may omit them) but never `.nullable()` (they can't be cleared).
 * Optional columns are `.nullable()` so clearing an inline field PATCHes null.
 *
 * CONTACT fields (phone / email / emergency contact) and `primaryLanguage`
 * are intentionally absent — deferred for the patient-profile vertical (no
 * backing columns; see decisions.md). `familyHistory` is never editable here
 * (dead legacy column; family history is its own entity, 6.10:1660).
 */

const sexEnum = z.enum(sex.enumValues);
const bloodTypeEnum = z.enum(bloodType.enumValues);

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

// height_cm / current_weight_kg are numeric columns (Drizzle surfaces numeric
// as string). Accept a plain positive decimal as text; the value round-trips
// to the column unchanged.
const numericString = z
  .string()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, "Expected a number like 172 or 70.5");

export const updatePatientSchema = z
  .object({
    name: z.string().min(1).optional(),
    preferredName: z.string().min(1).nullable().optional(),
    sex: sexEnum.optional(),
    dateOfBirth: dateOnlySchema.optional(),
    bloodType: bloodTypeEnum.nullable().optional(),
    heightCm: numericString.nullable().optional(),
    currentWeightKg: numericString.nullable().optional(),
    city: z.string().min(1).nullable().optional(),
    country: z.string().min(1).optional(),
    notes: z.string().nullable().optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
