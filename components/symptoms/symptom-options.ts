// Type-only import — enums used solely in `typeof X.enumValues` positions, so
// @/db/schema (and the DB layer) stays out of the client bundle (same safety as
// condition-options.ts / visit-options.ts).
import type {
  symptomBodyArea,
  symptomEpisodeSeverity,
  symptomStatus,
} from "@/db/schema";

/*
 * Shared option lists + label maps for the Symptom selects (Log-symptom form,
 * SymptomType inline edits) and read surfaces (timeline cards, detail pages,
 * citation pill). Single source so a label rewording can't drift across the
 * type-grouped timeline, the episode detail, and the type detail.
 */

type StatusValue = (typeof symptomStatus.enumValues)[number];
type BodyAreaValue = (typeof symptomBodyArea.enumValues)[number];
type SeverityValue = (typeof symptomEpisodeSeverity.enumValues)[number];

// Sentinel for optional selects — single source in lib/, re-exported so symptom
// surfaces don't reach across entity folders for it.
export { NOT_SET } from "@/lib/select-sentinel";

export const STATUS_OPTIONS: ReadonlyArray<{ value: StatusValue; label: string }> = [
  { value: "active", label: "Active" },
  { value: "monitoring", label: "Monitoring" },
  { value: "resolved", label: "Resolved" },
];

// Timeline grouping precedence (§6.6 — active types expanded, others collapsed).
// Lower index sorts first and renders expanded.
export const STATUS_ORDER: Record<StatusValue, number> = {
  active: 0,
  monitoring: 1,
  resolved: 2,
};

export const BODY_AREA_OPTIONS: ReadonlyArray<{ value: BodyAreaValue; label: string }> = [
  { value: "head", label: "Head" },
  { value: "chest", label: "Chest" },
  { value: "abdomen", label: "Abdomen" },
  { value: "back", label: "Back" },
  { value: "arms", label: "Arms" },
  { value: "legs", label: "Legs" },
  { value: "skin", label: "Skin" },
  { value: "general", label: "General" },
  { value: "other", label: "Other" },
];

export const SEVERITY_OPTIONS: ReadonlyArray<{ value: SeverityValue; label: string }> = [
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
];

export const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
);
export const BODY_AREA_LABEL: Record<string, string> = Object.fromEntries(
  BODY_AREA_OPTIONS.map((o) => [o.value, o.label]),
);
export const SEVERITY_LABEL: Record<string, string> = Object.fromEntries(
  SEVERITY_OPTIONS.map((o) => [o.value, o.label]),
);

// §6.6: severity pill MODERATE/SEVERE warm-tinted, MILD neutral. The warm tint
// rides `--accent` (no terra token in the palette yet — periwinkle-only, 7.2);
// swap point if a warm token lands.
export function severityIsWarm(severity: SeverityValue | null): boolean {
  return severity === "moderate" || severity === "severe";
}
