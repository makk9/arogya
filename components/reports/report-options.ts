import type { reportType } from "@/db/schema";

/*
 * Shared option list for the Report type Select (form, inline edit, filter) and
 * its label map for read surfaces. Single source for enum → display-label
 * pairing, same pattern as visit-options.ts. Type-only import from @/db/schema —
 * no runtime DB edge in the client bundle.
 */

type ReportTypeValue = (typeof reportType.enumValues)[number];

export const REPORT_TYPE_OPTIONS: ReadonlyArray<{
  value: ReportTypeValue;
  label: string;
}> = [
  { value: "discharge_summary", label: "Discharge summary" },
  { value: "doctor_letter", label: "Doctor letter" },
  { value: "prescription", label: "Prescription" },
  { value: "insurance", label: "Insurance" },
  { value: "imaging", label: "Imaging" },
  { value: "other", label: "Other" },
];

export const REPORT_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  REPORT_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

export { NOT_SET } from "@/lib/select-sentinel";
