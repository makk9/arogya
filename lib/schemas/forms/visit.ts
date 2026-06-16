import { z } from "zod";

import { visitStatus } from "@/db/schema";
import { createVisitSchema } from "@/lib/schemas/api/visit";

/**
 * Form-side schema for `Log visit` per design.md 6.12:1855 — the first event
 * form ("Log", not "Add"). Derived from `createVisitSchema` like the state
 * forms (lib/schemas/forms/allergy.ts).
 *
 * Shaping decisions:
 *  - §6.12's rough draft lists Doctor · Visit date · Visit type · Duration ·
 *    Summary. The locked Phase 4 schema has no `duration` column (spec gap,
 *    flagged in decisions.md), and DOES have chief complaint / diagnosis /
 *    next steps / status / notes — all of which a user logging a real visit
 *    wants at entry time, so the form renders the full Phase 4 field set.
 *  - `doctorId` is a required plain Select of the patient's doctors (the
 *    §6.12 rich autocomplete + `+ Create new` modal is the standing Phase D
 *    carryover). Unlike every prior form's doctor ref this one can't be
 *    omitted — visits.doctor_id is NOT NULL — so the page guards the
 *    zero-doctors state before the form renders.
 *  - `visitDate` defaults to today (browser-local per the 2026-06-10 user
 *    decision on form date defaults).
 *  - `status` defaults to Completed (DB default); Scheduled enables the
 *    pre-visit prep journey.
 */
export const visitFormSchema = createVisitSchema.extend({
  doctorId: z.string().min(1, "Pick a doctor."),
  visitDate: z.string().min(1, "Required"),
  visitType: z.string().optional(),
  status: z.enum(visitStatus.enumValues),
  chiefComplaint: z.string().optional(),
  summary: z.string().optional(),
  diagnosisText: z.string().optional(),
  nextSteps: z.string().optional(),
  notes: z.string().optional(),
});

export type VisitFormValues = z.infer<typeof visitFormSchema>;
