import { z } from "zod";

import { labResultFlag } from "@/db/schema";
import { isCalendarDate } from "@/lib/datetime";

/**
 * Zod schemas for /api/lab-reports routes — the second EVENT entity (§6.6/§6.7)
 * and the first one→many split (one report, many marker rows). Clones the Visit
 * event shape (lib/schemas/api/visit.ts) minus the change-log machinery, plus a
 * nested `results` array on create and a separate single-row correction schema.
 *
 * No `patientId` in any body — auth-derived via getCurrentPatient() (9.6:2755).
 *
 * Lab-specific shaping:
 *  - `results` are created WITH the report (one form, §6.12 "Markers sub-form")
 *    but corrected one row at a time afterward (§6.7 `+ Log a correction`).
 *    `result_date` is denormalized server-side from `report_date` (§4:401), so
 *    it is NOT in the per-result body.
 *  - `value` (numeric) and `valueText` (qualitative) are a split (§4:406): the
 *    form picks which to send. `markerNormalized` is AI-derived (§4:394) — not
 *    exposed at direct entry.
 *  - `source_file_url` / `source_report_id` are written by the Phase E
 *    extraction pipeline, never by direct entry (same exclusion as Visit's
 *    sourceReportId).
 */

const flagEnum = z.enum(labResultFlag.enumValues);

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .refine(isCalendarDate, "Not a real calendar date");

const uuidSchema = z.string().uuid();

// numeric columns round-trip as strings through Drizzle. Accept a plain decimal
// string; the form sends "" → undefined (omitted), never an empty numeric.
const numericStringSchema = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, "Must be a number");

// One marker row at create time. resultDate is denormalized from the report.
const createLabResultSchema = z
  .object({
    marker: z.string().min(1),
    value: numericStringSchema.optional(),
    valueText: z.string().min(1).optional(),
    unit: z.string().min(1).optional(),
    referenceLow: numericStringSchema.optional(),
    referenceHigh: numericStringSchema.optional(),
    flag: flagEnum.optional(),
    linkedCondition: uuidSchema.optional(),
  })
  .strict()
  // §4:406 — `value` (numeric) and `valueText` (qualitative) are a split, not a
  // pair. The form/dialog only ever send one; reject a body that sets both so a
  // direct API caller can't desync the column semantics.
  .refine((r) => !(r.value !== undefined && r.valueText !== undefined), {
    message: "value and valueText are mutually exclusive",
    path: ["value"],
  });

export const createLabReportSchema = z
  .object({
    reportDate: dateOnlySchema,
    reportType: z.string().min(1).optional(),
    labName: z.string().min(1).optional(),
    orderedBy: uuidSchema.optional(),
    linkedVisitId: uuidSchema.optional(),
    summary: z.string().min(1).optional(),
    notes: z.string().min(1).optional(),
    results: z.array(createLabResultSchema).default([]),
  })
  .strict();

// Report-level PATCH only — the MARKERS table is corrected through the
// dedicated results route, never here.
export const updateLabReportSchema = z
  .object({
    reportDate: dateOnlySchema.optional(),
    reportType: z.string().min(1).nullable().optional(),
    labName: z.string().min(1).nullable().optional(),
    orderedBy: uuidSchema.nullable().optional(),
    linkedVisitId: uuidSchema.nullable().optional(),
    summary: z.string().min(1).nullable().optional(),
    notes: z.string().min(1).nullable().optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

// §6.7 `+ Log a correction` — amends one already-stored marker in place. The
// marker name itself is immutable (it's the row's identity); only the measured
// fields amend. Nullable so a correction can clear a value (e.g. switch a
// numeric reading to qualitative).
export const correctLabResultSchema = z
  .object({
    value: numericStringSchema.nullable().optional(),
    valueText: z.string().min(1).nullable().optional(),
    unit: z.string().min(1).nullable().optional(),
    referenceLow: numericStringSchema.nullable().optional(),
    referenceHigh: numericStringSchema.nullable().optional(),
    flag: flagEnum.nullable().optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  })
  // Same §4:406 split as create: a correction may switch numeric ↔ qualitative
  // (clearing the other to null), but never set both.
  .refine((r) => !(r.value != null && r.valueText != null), {
    message: "value and valueText are mutually exclusive",
    path: ["value"],
  });

// `reportType` backs the §6.6 `All report types ▾` timeline filter pill.
export const listLabReportsQuerySchema = z
  .object({
    reportType: z.string().min(1).optional(),
  })
  .strict();

export type CreateLabReportInput = z.infer<typeof createLabReportSchema>;
export type UpdateLabReportInput = z.infer<typeof updateLabReportSchema>;
export type CorrectLabResultInput = z.infer<typeof correctLabResultSchema>;
