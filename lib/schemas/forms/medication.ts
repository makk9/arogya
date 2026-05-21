import { z } from "zod";

import { createMedicationSchema } from "@/lib/schemas/api/medication";

/**
 * Form-side schema for `Add medication` per design.md 6.12.
 *
 * Derived from `createMedicationSchema` (the API request body) via `.extend()`
 * so required-field constraints (name, currentDose, currentFrequency, category)
 * inherit automatically — a rename or new required field in the API schema
 * surfaces here as a TypeScript error rather than runtime drift.
 *
 * The form-side override on optional text fields is intentional: React Hook
 * Form initializes string inputs with `""` (not `undefined`), and the API
 * schema's `.min(1).optional()` rejects empty strings. The submit handler
 * coerces `""` → `undefined` before POST so the server sees the field as
 * omitted, matching the API contract.
 *
 * Form schemas live in `lib/schemas/forms/` per design.md 9.6:2796.
 */
export const medicationFormSchema = createMedicationSchema.extend({
  brandName: z.string().optional(),
  startedOn: z.string().optional(),
  notes: z.string().optional(),
});

export type MedicationFormValues = z.infer<typeof medicationFormSchema>;
