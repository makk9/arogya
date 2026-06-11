import { z } from "zod";

/**
 * Form-side schema for `Add family history` per design.md 6.12:1850
 * (Relation * · Relation specific · Condition * · Age of onset · Outcome ·
 * Notes). Mirrors lib/schemas/forms/allergy.ts.
 *
 * Unlike the other form schemas this is NOT derived from the create API schema
 * via `.extend()` — `ageOfOnset` is a number on the wire but a string in the
 * form (native number input), so the shapes diverge on that field. The submit
 * handler coerces and the server reparses with `createFamilyHistorySchema`
 * for the authoritative bounds check (0-130).
 *
 * `relation` starts on a placeholder (no default — §6.12:1850 stars it and the
 * column is NOT NULL with no default; the user must pick).
 */
export const familyHistoryFormSchema = z.object({
  // Permissive string — the Select starts on a placeholder and the server
  // reparses against the enum value-set for the authoritative check (same
  // treatment as the allergy form's category).
  relation: z.string().min(1, "Pick a relation."),
  relationSpecific: z.string().optional(),
  conditionName: z.string().min(1, "Required"),
  // Mirrors the API bounds (0-130) so the user gets the inline error without
  // a server round-trip; the server remains the authoritative check.
  ageOfOnset: z
    .string()
    .optional()
    .refine(
      (v) => {
        if (!v) return true;
        const t = v.trim();
        return /^\d{1,3}$/.test(t) && Number(t) <= 130;
      },
      { message: "Enter an age in years" },
    ),
  outcome: z.string().optional(),
  notes: z.string().optional(),
});

export type FamilyHistoryFormValues = z.infer<typeof familyHistoryFormSchema>;
