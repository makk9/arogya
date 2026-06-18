// Type-only import — the enums appear solely in `typeof X.enumValues` positions,
// never at runtime, so @/db/schema (and the whole DB layer) stays out of the
// client bundle (same safety as condition-options.ts / visit-options.ts).
import type {
  vitalContext,
  vitalFlag,
  vitalReadingType,
} from "@/db/schema";

// Single source in lib/ (shared with the agent serializer). Re-exported here so
// the existing `@/components/vitals/vital-options` import path keeps working.
export { formatVitalValue } from "@/lib/vitals";

/*
 * Shared option lists + label maps for VitalReading selects (the Log reading
 * form) and any read surface. VitalReading has no timeline/detail page in v1
 * (design.md 6.6 lists five event rail items; vitals are not one — they surface
 * as the `●` linked-vital pill on symptom episodes), so this is consumed by the
 * form and the symptom episode's linked-vital rendering only.
 *
 * Single source of truth so a label rewording can't drift across surfaces.
 */

type VitalReadingTypeValue = (typeof vitalReadingType.enumValues)[number];
type VitalContextValue = (typeof vitalContext.enumValues)[number];
type VitalFlagValue = (typeof vitalFlag.enumValues)[number];

export const READING_TYPE_OPTIONS: ReadonlyArray<{
  value: VitalReadingTypeValue;
  label: string;
}> = [
  { value: "blood_pressure", label: "Blood pressure" },
  { value: "weight", label: "Weight" },
  { value: "blood_glucose", label: "Blood glucose" },
  { value: "temperature", label: "Temperature" },
  { value: "heart_rate", label: "Heart rate" },
  { value: "oxygen_saturation", label: "Oxygen saturation" },
  { value: "respiratory_rate", label: "Respiratory rate" },
  { value: "other", label: "Other" },
];

// Reading types that carry two numbers (systolic / diastolic). Drives the
// secondary-value input on the form and the "88/55" rendering on episode pills.
export const TWO_VALUE_TYPES: ReadonlySet<string> = new Set(["blood_pressure"]);

// Suggested unit per reading type (§4:422). Pre-fills the unit input when the
// type changes; the user can still override (a glucose reading in mmol/L, etc.).
export const DEFAULT_UNIT: Record<VitalReadingTypeValue, string> = {
  blood_pressure: "mmHg",
  weight: "kg",
  blood_glucose: "mg/dL",
  temperature: "°C",
  heart_rate: "bpm",
  oxygen_saturation: "%",
  respiratory_rate: "breaths/min",
  other: "",
};

export const CONTEXT_OPTIONS: ReadonlyArray<{
  value: VitalContextValue;
  label: string;
}> = [
  { value: "fasting", label: "Fasting" },
  { value: "post_meal", label: "Post-meal" },
  { value: "morning", label: "Morning" },
  { value: "evening", label: "Evening" },
  { value: "pre_medication", label: "Before medication" },
  { value: "post_medication", label: "After medication" },
  { value: "other", label: "Other" },
];

export const FLAG_OPTIONS: ReadonlyArray<{
  value: VitalFlagValue;
  label: string;
}> = [
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export const READING_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  READING_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

export const CONTEXT_LABEL: Record<string, string> = Object.fromEntries(
  CONTEXT_OPTIONS.map((o) => [o.value, o.label]),
);

export const FLAG_LABEL: Record<string, string> = Object.fromEntries(
  FLAG_OPTIONS.map((o) => [o.value, o.label]),
);

