import { z } from "zod";

import {
  medicationCategory,
  medicationForm,
  medicationStatus,
} from "@/db/schema";

/**
 * Zod schemas for /api/medications routes per design.md 9.6:2776.
 *
 * No `patientId` in any body — auth-derived via getCurrentPatient() per the
 * 9.6:2755 tripwire.
 *
 * Update schema excludes the four `medicationChangeField` enum fields
 * (currentDose, currentFrequency, status, prescribingDoctor). Per-field
 * rejection guidance is surfaced by the PATCH route, not the schema — the
 * route pre-checks those four keys and returns a teaching `details` object
 * before Zod runs. .strict() here is a safety net for any other unknown key.
 *
 * Enum value-sets derive from the Drizzle pgEnums (single source of truth);
 * adding a value to the schema flows through here without code drift.
 */

const medicationFormEnum = z.enum(medicationForm.enumValues);
const medicationCategoryEnum = z.enum(medicationCategory.enumValues);
const medicationStatusEnum = z.enum(medicationStatus.enumValues);

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const uuidSchema = z.string().uuid();

export const createMedicationSchema = z
  .object({
    name: z.string().min(1),
    currentDose: z.string().min(1),
    currentFrequency: z.string().min(1),
    category: medicationCategoryEnum,
    brandName: z.string().min(1).optional(),
    form: medicationFormEnum.optional(),
    purpose: uuidSchema.optional(),
    prescribingDoctor: uuidSchema.optional(),
    startedOn: dateOnlySchema.optional(),
    notes: z.string().optional(),
  })
  .strict();

export const updateMedicationSchema = z
  .object({
    name: z.string().min(1).optional(),
    brandName: z.string().min(1).nullable().optional(),
    form: medicationFormEnum.nullable().optional(),
    purpose: uuidSchema.nullable().optional(),
    category: medicationCategoryEnum.optional(),
    startedOn: dateOnlySchema.nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

export const discontinueMedicationSchema = z
  .object({
    reason: z.string().min(1),
    linkedVisitId: uuidSchema.optional(),
  })
  .strict();

// Discriminated union on `field` — newValue's shape varies per branch:
// dose/frequency are free text, status is constrained to "paused" (active→
// paused is the only v1 transition via this endpoint; discontinue uses its
// own route; resume from paused is v1.5), prescribing_doctor is a uuid.
//
// Shared base fields (reason / changedAt / linkedVisitId) sit in
// medicationChangeBase and are spread into each branch via .extend(). The
// route reparses the request body with this schema after the path uuid + JSON
// checks, so failure surfaces with the standard flatten()'d details payload.
const medicationChangeBase = z.object({
  reason: z.string().min(1).optional(),
  changedAt: dateOnlySchema.optional(),
  linkedVisitId: uuidSchema.optional(),
});

export const createMedicationChangeSchema = z.discriminatedUnion("field", [
  medicationChangeBase.extend({
    field: z.literal("dose"),
    newValue: z.string().min(1),
  }),
  medicationChangeBase.extend({
    field: z.literal("frequency"),
    newValue: z.string().min(1),
  }),
  medicationChangeBase.extend({
    field: z.literal("status"),
    newValue: z.literal("paused"),
  }),
  medicationChangeBase.extend({
    field: z.literal("prescribing_doctor"),
    newValue: uuidSchema,
  }),
]);

export const listMedicationsQuerySchema = z
  .object({
    status: medicationStatusEnum.optional(),
  })
  .strict();

export type CreateMedicationInput = z.infer<typeof createMedicationSchema>;
export type UpdateMedicationInput = z.infer<typeof updateMedicationSchema>;
export type DiscontinueMedicationInput = z.infer<
  typeof discontinueMedicationSchema
>;
export type CreateMedicationChangeInput = z.infer<
  typeof createMedicationChangeSchema
>;
