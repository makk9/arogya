import { z } from "zod";

/**
 * Zod schemas for /api/doctors routes. Clones lib/schemas/api/condition.ts.
 *
 * No `patientId` in any body — auth-derived via getCurrentPatient() per the
 * 9.6:2755 tripwire.
 *
 * The Doctor state model has no enums (specialty is free text in v1 per Phase 4;
 * a scoped enum is v2) and no status machine. Phase 4 leaves doctor_changes.field
 * unconstrained ("rare changes"); the project decision (decisions.md 2026-06-09)
 * is that `specialty` and `clinic` are the change-logged fields — they're the
 * synthesis-relevant transitions ("the cardiologist moved from Apollo to
 * Manipal") — while contact details (phone / email / address), name, firstVisit,
 * and notes are plain PATCH-editable facts.
 *
 * Update schema excludes the two change-logged fields. Per-field rejection
 * guidance is surfaced by the PATCH route, not the schema. .strict() is a safety
 * net for any other unknown key.
 */

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

/**
 * Create accepts the change-logged fields (specialty / clinic) directly — at
 * create-time there is no prior value to log, exactly as Condition-create
 * accepts status/severity. `email` is validated for shape even though no v1
 * form renders it (the 6.12 Add-doctor field set omits it); the API accepts it
 * so the column isn't write-only, and the detail grid inline-edits it.
 */
export const createDoctorSchema = z
  .object({
    name: z.string().min(1),
    specialty: z.string().min(1),
    clinic: z.string().min(1).optional(),
    phone: z.string().min(1).optional(),
    email: z.string().email().optional(),
    address: z.string().min(1).optional(),
    firstVisit: dateOnlySchema.optional(),
    notes: z.string().optional(),
  })
  .strict();

export const updateDoctorSchema = z
  .object({
    name: z.string().min(1).optional(),
    phone: z.string().min(1).nullable().optional(),
    email: z.string().email().nullable().optional(),
    address: z.string().min(1).nullable().optional(),
    firstVisit: dateOnlySchema.nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

// Discriminated union on `field` for shape-parity with Medication/Condition,
// even though both branches carry the same free-text newValue — a future
// constrained branch (e.g. a v2 specialty enum) slots in without reshaping.
const doctorChangeBase = z.object({
  reason: z.string().min(1).optional(),
  changedAt: dateOnlySchema.optional(),
});

export const createDoctorChangeSchema = z.discriminatedUnion("field", [
  doctorChangeBase.extend({
    field: z.literal("specialty"),
    newValue: z.string().min(1),
  }),
  doctorChangeBase.extend({
    field: z.literal("clinic"),
    newValue: z.string().min(1),
  }),
]);

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;
export type CreateDoctorChangeInput = z.infer<typeof createDoctorChangeSchema>;
