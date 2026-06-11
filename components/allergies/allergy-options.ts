// Type-only import: the enums are used solely in `typeof X.enumValues`
// positions below, never at runtime — keeps @/db/schema out of the client
// bundle. Mirrors condition-options.ts.
import type {
  allergyCategory,
  allergySeverity,
  allergyStatus,
} from "@/db/schema";

// Shared label maps for the allergy status / severity / category enums.
// Consumed by the Add Allergy form, the list/detail surfaces, and the citation
// pill. Single source of truth so label rewordings don't drift across surfaces.
//
// No NOT_SET sentinel here: unlike Condition's severity, both optional-feeling
// allergy selects (status, severity) have DB defaults — there is no null state
// to represent. The doctor inline-select imports NOT_SET from
// condition-options (the established cross-entity source, per doctor-form).

// Display order is clinical, not schema order: suspected sits next to active
// because §4:271 calls it medically meaningful; the AI treats it differently.
export const STATUS_OPTIONS: ReadonlyArray<{
  value: (typeof allergyStatus.enumValues)[number];
  label: string;
}> = [
  { value: "active", label: "Active" },
  { value: "suspected", label: "Suspected" },
  { value: "resolved", label: "Resolved" },
  { value: "disproved", label: "Disproved" },
];

export const SEVERITY_OPTIONS: ReadonlyArray<{
  value: (typeof allergySeverity.enumValues)[number];
  label: string;
}> = [
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
  { value: "unknown", label: "Unknown" },
];

export const CATEGORY_OPTIONS: ReadonlyArray<{
  value: (typeof allergyCategory.enumValues)[number];
  label: string;
}> = [
  { value: "drug", label: "Drug" },
  { value: "food", label: "Food" },
  { value: "environmental", label: "Environmental" },
  { value: "other", label: "Other" },
];
