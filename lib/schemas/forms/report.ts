import { z } from "zod";

import { createReportSchema } from "@/lib/schemas/api/report";

/**
 * Form-side schema for `Log report` per design.md 6.12:1860 — Title · Report
 * type · Date issued · Linked visit · Source file · Content · Notes. Derived
 * from `createReportSchema` like the other event forms (lib/schemas/forms/visit.ts).
 *
 * Shaping decisions:
 *  - `title` is required (NOT NULL, §4:485). `reportDate` ("Date issued")
 *    required and defaults to today (browser-local per the 2026-06-10 user
 *    decision on form date defaults).
 *  - `reportType` is an optional plain Select of the §4:486 enum; the "—" clear
 *    row is handled in the form via the NOT_SET sentinel.
 *  - Linked visit AND linked doctor are optional plain Selects of the patient's
 *    visits / doctors (the §6.12 rich autocomplete + `+ Create new` modal is the
 *    standing Phase D carryover). §6.12's draft lists only "Linked visit"; the
 *    Phase 4 schema also carries `linked_doctor_id` ("Author/source", §4:491),
 *    surfaced here so the document's source is capturable at entry.
 *  - "Source file" (§6.12) is DEFERRED to Phase E with the upload/extraction
 *    pipeline — the form is text-only entry (Content markdown) for v1 Phase D.
 *    Flagged in decisions.md.
 *  - Empty-string selects/textareas coerce to undefined on the wire (server
 *    contracts are `.min(1).optional()`), same as the Visit form.
 */
export const reportFormSchema = createReportSchema.extend({
  title: z.string().min(1, "Required"),
  reportDate: z.string().min(1, "Required"),
  reportType: z.string().optional(),
  linkedVisitId: z.string().optional(),
  linkedDoctorId: z.string().optional(),
  content: z.string().optional(),
  notes: z.string().optional(),
});

export type ReportFormValues = z.infer<typeof reportFormSchema>;
