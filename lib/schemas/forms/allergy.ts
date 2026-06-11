import { z } from "zod";

import { allergySeverity, allergyStatus } from "@/db/schema";
import { createAllergySchema } from "@/lib/schemas/api/allergy";

/**
 * Form-side schema for `Add allergy` per design.md 6.12:1848.
 *
 * Derived from `createAllergySchema` (the API request body) so the required
 * `substance` constraint inherits automatically. Mirrors
 * `lib/schemas/forms/condition.ts`.
 *
 * Shaping decisions:
 *  - `confirmedBy` is `.omit()`-ed — the §6.12 doctor autocomplete (+ `+ Create
 *    new` inline modal) is the standing Phase D carryover; the ref is settable
 *    post-create via inline edit on the detail page, same as Condition's
 *    diagnosedBy.
 *  - `category` is required and replaced with a min(1) string — the Select
 *    starts on a placeholder (no default; the user must pick, since category
 *    scopes AI risk reasoning per §4:259) and the server reparses against the
 *    enum value-set for the authoritative check.
 *  - `status` / `severity` are required selects with defaults (Active /
 *    Unknown) — both columns have DB defaults, so there is no null state to
 *    represent and no NOT_SET sentinel is needed (unlike Condition's severity).
 */
export const allergyFormSchema = createAllergySchema
  .omit({ confirmedBy: true })
  .extend({
    category: z.string().min(1, "Pick a category."),
    status: z.enum(allergyStatus.enumValues),
    severity: z.enum(allergySeverity.enumValues),
    reaction: z.string().optional(),
    firstNoted: z.string().optional(),
    notes: z.string().optional(),
  });

export type AllergyFormValues = z.infer<typeof allergyFormSchema>;

/**
 * Flat form-side schema for the `+ Log a change` dialog. Permissive newValue
 * string; the submit handler reparses with the API's
 * `createAllergyChangeSchema` (discriminated union) before POSTing — same
 * defense-in-depth pattern as the Condition change form.
 *
 * Two change fields only: status / severity (§6.5:1402 Allergy History axes).
 */
export const allergyChangeFormSchema = z.object({
  field: z.enum(["status", "severity"]),
  newValue: z.string().min(1, "Required"),
  reason: z.string().optional(),
  changedAt: z.string().optional(),
});

export type AllergyChangeFormValues = z.infer<typeof allergyChangeFormSchema>;
