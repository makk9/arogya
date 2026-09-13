import { z } from "zod";

import { vitalContext, vitalFlag, vitalReadingType } from "@/db/schema";

/**
 * Form-side schema for `Log reading` — the VitalReading create form. Decoupled
 * from the API schema (lib/schemas/api/vital-reading.ts) because the form holds
 * a single datetime-local string (`recordedAtLocal`, "YYYY-MM-DDTHH:mm") that
 * the submit handler converts to a full ISO datetime, and because the numeric
 * value inputs are plain text fields validated here before the request is built.
 *
 * There is no §6.12 wireframe for a vital form (vitals are a quick-log surface,
 * §4:412), so the field set follows the Phase 4 table: reading type · recorded
 * at · value(s) · unit · context · flag · notes. Two-value types (blood
 * pressure) surface the secondary input; everything else hides it.
 */

const NUMERIC_RE = /^-?\d+(\.\d+)?$/;

export const vitalFormSchema = z
  .object({
    readingType: z.enum(vitalReadingType.enumValues),
    recordedAtLocal: z.string().min(1, "Required"),
    valuePrimary: z.string().min(1, "Required"),
    valueSecondary: z.string(),
    unit: z.string().min(1, "Required"),
    context: z.union([z.enum(vitalContext.enumValues), z.literal("")]),
    flag: z.union([z.enum(vitalFlag.enumValues), z.literal("")]),
    notes: z.string(),
  })
  .superRefine((v, ctx) => {
    if (!NUMERIC_RE.test(v.valuePrimary.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["valuePrimary"],
        message: "Must be a number.",
      });
    }
    // Only two-value types show (and submit) the secondary input — a stale
    // diastolic left over from blood pressure must not block a hidden field.
    if (
      v.readingType === "blood_pressure" &&
      v.valueSecondary.trim() !== "" &&
      !NUMERIC_RE.test(v.valueSecondary.trim())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["valueSecondary"],
        message: "Must be a number.",
      });
    }
  });

export type VitalFormValues = z.infer<typeof vitalFormSchema>;
