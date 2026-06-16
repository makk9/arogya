import type { visitStatus, visitType } from "@/db/schema";

/*
 * Shared option lists for Visit selects (form, inline edit, filters) and label
 * maps for read surfaces. Single source for enum → display-label pairing, same
 * pattern as allergy-options.ts. Type-only import from @/db/schema — no
 * runtime DB edge in the client bundle.
 */

type VisitTypeValue = (typeof visitType.enumValues)[number];
type VisitStatusValue = (typeof visitStatus.enumValues)[number];

export const VISIT_TYPE_OPTIONS: ReadonlyArray<{
  value: VisitTypeValue;
  label: string;
}> = [
  { value: "routine_followup", label: "Routine follow-up" },
  { value: "new_consultation", label: "New consultation" },
  { value: "urgent", label: "Urgent" },
  { value: "specialist_referral", label: "Specialist referral" },
  { value: "second_opinion", label: "Second opinion" },
  { value: "telemedicine", label: "Telemedicine" },
  { value: "hospitalization", label: "Hospitalization" },
  { value: "surgery", label: "Surgery" },
  { value: "other", label: "Other" },
];

// Clinical-lifecycle order: the upcoming state first, then the terminal ones.
export const STATUS_OPTIONS: ReadonlyArray<{
  value: VisitStatusValue;
  label: string;
}> = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
];

export const VISIT_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  VISIT_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

export const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
);
