// Type-only imports: the enums are used solely in `typeof X.enumValues`
// positions below, never at runtime — keeps @/db/schema out of the client
// bundle. Mirrors allergy-options.ts.
import type {
  lifestyleAlcoholUse,
  lifestyleExerciseIntensity,
  lifestyleStressLevel,
  lifestyleTobaccoUse,
} from "@/db/schema";

// Shared label maps for the four lifestyle enums + the trend-field selector.
// Consumed by the detail surface, the `+ Log a change` dialog, and the change
// entries. Single source of truth so label rewordings don't drift.

export const EXERCISE_INTENSITY_OPTIONS: ReadonlyArray<{
  value: (typeof lifestyleExerciseIntensity.enumValues)[number];
  label: string;
}> = [
  { value: "sedentary", label: "Sedentary" },
  { value: "light", label: "Light" },
  { value: "moderate", label: "Moderate" },
  { value: "active", label: "Active" },
  { value: "very_active", label: "Very active" },
];

export const STRESS_LEVEL_OPTIONS: ReadonlyArray<{
  value: (typeof lifestyleStressLevel.enumValues)[number];
  label: string;
}> = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
  { value: "variable", label: "Variable" },
];

export const TOBACCO_USE_OPTIONS: ReadonlyArray<{
  value: (typeof lifestyleTobaccoUse.enumValues)[number];
  label: string;
}> = [
  { value: "never", label: "Never" },
  { value: "former", label: "Former" },
  { value: "current", label: "Current" },
];

export const ALCOHOL_USE_OPTIONS: ReadonlyArray<{
  value: (typeof lifestyleAlcoholUse.enumValues)[number];
  label: string;
}> = [
  { value: "never", label: "Never" },
  { value: "occasional", label: "Occasional" },
  { value: "regular", label: "Regular" },
  { value: "former", label: "Former" },
];

// The seven §4:538 trend-story fields, as the `+ Log a change` selector sees
// them. `kind` drives the value control: free-text patterns get a textarea
// (prefilled with the current value — trend changes are usually edits of the
// prior narrative), enums get a select excluding the current value.
export type LifestyleTrendFieldKey =
  | "dietPattern"
  | "exercisePattern"
  | "sleepPattern"
  | "exerciseIntensity"
  | "stressLevel"
  | "tobaccoUse"
  | "alcoholUse";

export const TREND_FIELD_OPTIONS: ReadonlyArray<{
  value: LifestyleTrendFieldKey;
  label: string;
  kind: "text" | "enum";
}> = [
  { value: "dietPattern", label: "Diet pattern", kind: "text" },
  { value: "exercisePattern", label: "Exercise pattern", kind: "text" },
  { value: "sleepPattern", label: "Sleep pattern", kind: "text" },
  { value: "exerciseIntensity", label: "Exercise intensity", kind: "enum" },
  { value: "stressLevel", label: "Stress level", kind: "enum" },
  { value: "tobaccoUse", label: "Tobacco use", kind: "enum" },
  { value: "alcoholUse", label: "Alcohol use", kind: "enum" },
];

export const TREND_FIELD_LABEL: Record<string, string> = Object.fromEntries(
  TREND_FIELD_OPTIONS.map((o) => [o.value, o.label]),
);

export function enumOptionsFor(
  field: LifestyleTrendFieldKey,
): ReadonlyArray<{ value: string; label: string }> | null {
  switch (field) {
    case "exerciseIntensity":
      return EXERCISE_INTENSITY_OPTIONS;
    case "stressLevel":
      return STRESS_LEVEL_OPTIONS;
    case "tobaccoUse":
      return TOBACCO_USE_OPTIONS;
    case "alcoholUse":
      return ALCOHOL_USE_OPTIONS;
    default:
      return null;
  }
}

// Resolves an enum value to its display label; free-text values pass through.
export function trendValueLabel(field: string, value: string): string {
  const options = enumOptionsFor(field as LifestyleTrendFieldKey);
  if (!options) return value;
  return options.find((o) => o.value === value)?.label ?? value;
}
