import { z } from "zod";

/**
 * Form-side schema for `Log lab report` per design.md 6.12:1858 — the second
 * event form and the first with a nested sub-form (the LabResult "Markers"
 * rows). Decoupled from the API schema (lib/schemas/api/lab-report.ts) because
 * the form carries a single `value` text input per marker that the submit
 * handler splits into the numeric `value` / qualitative `valueText` columns
 * (§4:406), and tolerates partially-filled marker rows that get cleaned before
 * the request is built.
 *
 * §6.12 lab field set: Lab name · Report type · Date received · Ordering doctor
 * · (Source file — deferred to the Phase E extraction path) · Markers sub-form
 * · Notes. `linkedVisitId` / `summary` / `linked_condition` are NOT manual-form
 * fields — they're extraction/AI-set (or, for linkedVisit, set from the
 * ordering visit). The detail Edit surface can still touch summary post-hoc.
 */

// Shared so the form schema, toResultPayload, and the correction dialog all
// agree on what counts as a numeric `value` vs a qualitative `valueText`
// (§4:406) — they must round-trip identically, so the regex lives in one place.
export const NUMERIC_VALUE_RE = /^-?\d+(\.\d+)?$/;
const NUMERIC_RE = NUMERIC_VALUE_RE;

const markerRowSchema = z
  .object({
    marker: z.string(),
    // One free input; the submit handler routes a numeric string to `value`,
    // anything else to `valueText`.
    value: z.string(),
    unit: z.string(),
    referenceLow: z.string(),
    referenceHigh: z.string(),
    flag: z.string(),
  })
  .superRefine((row, ctx) => {
    const hasAnyValue =
      row.value.trim() !== "" ||
      row.unit.trim() !== "" ||
      row.referenceLow.trim() !== "" ||
      row.referenceHigh.trim() !== "" ||
      (row.flag.trim() !== "" && row.flag !== "normal");
    // A row with data but no marker name is meaningless — name it or clear it.
    if (hasAnyValue && row.marker.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["marker"],
        message: "Name this marker, or clear the row.",
      });
    }
    if (row.referenceLow.trim() !== "" && !NUMERIC_RE.test(row.referenceLow.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["referenceLow"],
        message: "Must be a number.",
      });
    }
    if (
      row.referenceHigh.trim() !== "" &&
      !NUMERIC_RE.test(row.referenceHigh.trim())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["referenceHigh"],
        message: "Must be a number.",
      });
    }
  });

export const labReportFormSchema = z.object({
  reportDate: z.string().min(1, "Required"),
  reportType: z.string().optional(),
  labName: z.string().optional(),
  orderedBy: z.string().optional(),
  notes: z.string().optional(),
  results: z.array(markerRowSchema),
});

export type LabReportFormValues = z.infer<typeof labReportFormSchema>;
export type MarkerRowValues = z.infer<typeof markerRowSchema>;

/** A blank marker row for useFieldArray seeding / appends. */
export const EMPTY_MARKER_ROW: MarkerRowValues = {
  marker: "",
  value: "",
  unit: "",
  referenceLow: "",
  referenceHigh: "",
  flag: "",
};

/**
 * Reduces the form's marker rows to the API's result shape: drops fully-empty
 * rows, trims, and splits the single `value` input into numeric `value` vs
 * qualitative `valueText` (§4:406).
 */
export function toResultPayload(
  rows: ReadonlyArray<MarkerRowValues>,
): Array<{
  marker: string;
  value?: string;
  valueText?: string;
  unit?: string;
  referenceLow?: string;
  referenceHigh?: string;
  flag?: "normal" | "low" | "high" | "critical";
}> {
  const out: ReturnType<typeof toResultPayload> = [];
  for (const row of rows) {
    const marker = row.marker.trim();
    if (marker === "") continue; // empty row — skipped (validated above)
    const rawValue = row.value.trim();
    const entry: (typeof out)[number] = { marker };
    if (rawValue !== "") {
      if (NUMERIC_RE.test(rawValue)) entry.value = rawValue;
      else entry.valueText = rawValue;
    }
    if (row.unit.trim() !== "") entry.unit = row.unit.trim();
    if (row.referenceLow.trim() !== "") entry.referenceLow = row.referenceLow.trim();
    if (row.referenceHigh.trim() !== "")
      entry.referenceHigh = row.referenceHigh.trim();
    const flag = row.flag.trim();
    if (flag === "normal" || flag === "low" || flag === "high" || flag === "critical") {
      entry.flag = flag;
    }
    out.push(entry);
  }
  return out;
}
