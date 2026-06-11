import { z } from "zod";

/**
 * Flat form-side schema for the Lifestyle `+ Log a change` dialog. Permissive
 * newValue string; the submit handler reparses with the API's
 * `createLifestyleChangeSchema` (discriminated union) before POSTing — same
 * defense-in-depth pattern as the Allergy change form.
 *
 * Seven change fields — the §4:538 trend axes. The literal list is repeated
 * here rather than imported from db/queries/lifestyle (that module pulls in
 * @/db, which is server-only); the API schema remains the authoritative guard.
 *
 * There is no `Add lifestyle` form schema — the profile is a lazily-upserted
 * singleton with no §6.12 form (decisions.md 2026-06-10).
 */
export const lifestyleChangeFormSchema = z.object({
  field: z.enum([
    "dietPattern",
    "exercisePattern",
    "sleepPattern",
    "exerciseIntensity",
    "stressLevel",
    "tobaccoUse",
    "alcoholUse",
  ]),
  newValue: z.string().min(1, "Required"),
  reason: z.string().optional(),
  changedAt: z.string().optional(),
});

export type LifestyleChangeFormValues = z.infer<
  typeof lifestyleChangeFormSchema
>;
