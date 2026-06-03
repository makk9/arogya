import { z } from "zod";

import { conditionStatus } from "@/db/schema";
import { createConditionSchema } from "@/lib/schemas/api/condition";

/**
 * Form-side schema for `Add condition` per design.md 6.12.
 *
 * Derived from `createConditionSchema` (the API request body) so the required
 * `name` constraint inherits automatically — a rename or new required field in
 * the API schema surfaces here as a TypeScript error rather than runtime drift.
 * Mirrors `lib/schemas/forms/medication.ts`.
 *
 * Two shaping decisions:
 *  - The linked-doctor fields (`diagnosedBy`, `managingDoctor`) and `icdCode`
 *    are `.omit()`-ed. The doctor fields need the autocomplete + `+ Create new`
 *    pattern, which lands with the Doctor entity later in Phase D — same reason
 *    the medication form omits `prescribingDoctor`/`purpose`. `icdCode` is not a
 *    6.12 field (extraction/API concern), so the manual form skips it.
 *  - `status` is required in the form (defaults to Active per 6.12) even though
 *    the API treats it as optional (DB column default). `severity`/`category`
 *    stay permissive strings because the Select renders a "not set" sentinel that
 *    the submit handler coerces to `undefined`; the server reparses against the
 *    enum value-sets for the authoritative check (same defense-in-depth as the
 *    medication change form).
 *
 * Form schemas live in `lib/schemas/forms/` per design.md 9.6:2796.
 */
export const conditionFormSchema = createConditionSchema
  .omit({ icdCode: true, diagnosedBy: true, managingDoctor: true })
  .extend({
    status: z.enum(conditionStatus.enumValues),
    severity: z.string().optional(),
    category: z.string().optional(),
    diagnosedOn: z.string().optional(),
    notes: z.string().optional(),
  });

export type ConditionFormValues = z.infer<typeof conditionFormSchema>;
