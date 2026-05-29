import { medicationCategory, medicationForm } from "@/db/schema";

// Shared label maps for medication form + category enums. Consumed by
// `medication-form.tsx` (the Add Medication form) and by `inline-field.tsx`
// (the per-cell edit primitive on the detail page). Single source of truth so
// label rewordings don't drift across surfaces.

export const FORM_OPTIONS: ReadonlyArray<{
  value: (typeof medicationForm.enumValues)[number];
  label: string;
}> = [
  { value: "tablet", label: "Tablet" },
  { value: "capsule", label: "Capsule" },
  { value: "liquid", label: "Liquid" },
  { value: "injection", label: "Injection" },
  { value: "topical", label: "Topical" },
  { value: "inhaler", label: "Inhaler" },
  { value: "patch", label: "Patch" },
  { value: "drops", label: "Drops" },
  { value: "other", label: "Other" },
];

export const CATEGORY_OPTIONS: ReadonlyArray<{
  value: (typeof medicationCategory.enumValues)[number];
  label: string;
}> = [
  { value: "allopathic", label: "Allopathic" },
  { value: "ayurvedic", label: "Ayurvedic" },
  { value: "homeopathic", label: "Homeopathic" },
  { value: "supplement", label: "Supplement" },
  { value: "OTC", label: "OTC" },
  { value: "other", label: "Other" },
];
