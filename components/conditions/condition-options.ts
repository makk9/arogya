// Type-only import: the enums are used solely in `typeof X.enumValues` positions
// below, never at runtime. Keeping this `import type` stops @/db/schema (and the
// whole DB layer) from being pulled into the client bundle, and avoids the
// temporal-dead-zone that a runtime edge here caused in early-loaded consumers
// like citation-pill.tsx.
import type {
  conditionCategory,
  conditionSeverity,
  conditionStatus,
} from "@/db/schema";

// Shared label maps for the condition status / severity / category enums.
// Consumed by `condition-form.tsx` (the Add Condition form) and — once it
// lands — by the detail page's inline-edit primitive. Single source of truth so
// label rewordings don't drift across surfaces. Mirrors `medication-options.ts`.

// Sentinel for the optional Severity + Category selects. shadcn's `Select`
// cannot hold an empty-string value, so the "no value chosen" row carries this
// instead; the form's submit handler coerces it back to `undefined` (→ the
// server stores null). See the form schema's note on the null-vs-`unknown`
// distinction for severity.
export const NOT_SET = "__unset__" as const;

export const STATUS_OPTIONS: ReadonlyArray<{
  value: (typeof conditionStatus.enumValues)[number];
  label: string;
}> = [
  { value: "active", label: "Active" },
  { value: "controlled", label: "Controlled" },
  { value: "in_remission", label: "In remission" },
  { value: "resolved", label: "Resolved" },
  { value: "suspected", label: "Suspected" },
];

export const SEVERITY_OPTIONS: ReadonlyArray<{
  value: (typeof conditionSeverity.enumValues)[number];
  label: string;
}> = [
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
  { value: "unknown", label: "Unknown" },
];

export const CATEGORY_OPTIONS: ReadonlyArray<{
  value: (typeof conditionCategory.enumValues)[number];
  label: string;
}> = [
  { value: "cardiovascular", label: "Cardiovascular" },
  { value: "endocrine", label: "Endocrine" },
  { value: "renal", label: "Renal" },
  { value: "neurological", label: "Neurological" },
  { value: "musculoskeletal", label: "Musculoskeletal" },
  { value: "mental_health", label: "Mental health" },
  { value: "oncology", label: "Oncology" },
  { value: "hematological", label: "Hematological" },
  { value: "dermatological", label: "Dermatological" },
  { value: "gastrointestinal", label: "Gastrointestinal" },
  { value: "respiratory", label: "Respiratory" },
  { value: "autoimmune", label: "Autoimmune" },
  { value: "other", label: "Other" },
];
