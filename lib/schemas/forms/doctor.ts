import { z } from "zod";

import { createDoctorSchema } from "@/lib/schemas/api/doctor";

/**
 * Form-side schema for `Add doctor` per design.md 6.12:1846 — Name * ·
 * Specialty * · Clinic / hospital · Phone · Address · First visit date · Notes.
 *
 * Derived from `createDoctorSchema` (the API request body) so the required
 * name/specialty constraints inherit automatically. Mirrors
 * `lib/schemas/forms/condition.ts`.
 *
 * Shaping decisions:
 *  - `email` is `.omit()`-ed: the 6.12 Add-doctor field set doesn't include it
 *    (deliberate spec-faithfulness; the detail grid inline-edits it instead).
 *  - Optional fields relax to plain strings because empty inputs hold "" — the
 *    submit handler coerces "" → undefined so the wire body matches the API's
 *    `.min(1).optional()` contracts (same defense-in-depth as Condition).
 *  - Specialty's 6.12 "autocomplete" annotation is deferred the same way the
 *    medication form deferred its name autocomplete (v1.5) — free text in v1.
 */
export const doctorFormSchema = createDoctorSchema.omit({ email: true }).extend({
  clinic: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  firstVisit: z.string().optional(),
  notes: z.string().optional(),
});

export type DoctorFormValues = z.infer<typeof doctorFormSchema>;

/**
 * Flat form-side schema for the `+ Log a change` dialog. Same shape-stability
 * rationale as the Condition change form: RHF keeps one schema across `field`
 * switches, and the submit handler reparses with the API's
 * `createDoctorChangeSchema` before POSTing. The two change fields are the
 * project-locked Doctor history axes (decisions.md 2026-06-09): specialty /
 * clinic. Both carry free-text newValue.
 */
export const doctorChangeFormSchema = z.object({
  field: z.enum(["specialty", "clinic"]),
  newValue: z.string().min(1, "Required"),
  reason: z.string().optional(),
  changedAt: z.string().optional(),
});

export type DoctorChangeFormValues = z.infer<typeof doctorChangeFormSchema>;
