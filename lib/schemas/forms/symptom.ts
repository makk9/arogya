import { z } from "zod";

import { symptomBodyArea, symptomEpisodeSeverity } from "@/db/schema";

/**
 * Form-side schema for `Log symptom` per design.md 6.12:1854. Decoupled from the
 * API schema (lib/schemas/api/symptom.ts): the form holds a datetime-local
 * string and numeric text inputs the submit handler converts, and folds the
 * "existing type vs. + Create new" choice into a single `typeSelection` control.
 *
 * §6.12's draft lists Symptom type · Date+time · Duration · Severity ·
 * Description · Linked vital · Notes. Following the Log-visit precedent
 * (decisions.md — the schema's clinical fields must have an entry path at log
 * time), this also surfaces `triggers` and `relief` (separate Phase 4 fields,
 * §4:475). Linked vital is a single optional select in v1 (the array supports
 * more, set later by extraction/AI) — flagged.
 */

// Sentinel for the "+ Create new symptom" row in the type select.
export const NEW_TYPE = "__new__" as const;

const NUMERIC_RE = /^\d+$/;

export const symptomFormSchema = z
  .object({
    typeSelection: z.string().min(1, "Pick or create a symptom."),
    newTypeName: z.string(),
    newTypeBodyArea: z.union([z.enum(symptomBodyArea.enumValues), z.literal("")]),
    startedAtLocal: z.string().min(1, "Required"),
    durationMinutes: z.string(),
    severity: z.union([z.enum(symptomEpisodeSeverity.enumValues), z.literal("")]),
    description: z.string(),
    triggers: z.string(),
    relief: z.string(),
    linkedVitalId: z.string(),
    notes: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.typeSelection === NEW_TYPE && v.newTypeName.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newTypeName"],
        message: "Name the new symptom.",
      });
    }
    const dm = v.durationMinutes.trim();
    // Match the API's positive-int contract client-side ("0"/negatives pass the
    // digit regex but the server's .positive() rejects them).
    if (dm !== "" && (!NUMERIC_RE.test(dm) || Number(dm) < 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["durationMinutes"],
        message: "Enter a whole number of minutes (at least 1).",
      });
    }
  });

export type SymptomFormValues = z.infer<typeof symptomFormSchema>;
