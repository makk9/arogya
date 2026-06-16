import { NOT_SET } from "@/components/conditions/condition-options";
import type { labResultFlag } from "@/db/schema";

/*
 * Shared option lists + label maps for Lab marker flags. Single source for the
 * flag enum → display pairing across the form, correction dialog, MARKERS table,
 * and timeline preview. Type-only import from @/db/schema — no runtime DB edge
 * in the client bundle (same pattern as visit-options.ts).
 */

type FlagValue = (typeof labResultFlag.enumValues)[number];

// Form / correction Select rows, in clinical reading order.
export const FLAG_OPTIONS: ReadonlyArray<{ value: FlagValue; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

// Plain enum labels (Select display).
export const FLAG_LABEL: Record<string, string> = Object.fromEntries(
  FLAG_OPTIONS.map((o) => [o.value, o.label]),
);

// Clearable Select rows (leading "—" sentinel) — shared by the create form's
// per-marker flag picker and the correction dialog so the option set is defined
// once.
export const FLAG_SELECT_ITEMS: ReadonlyArray<{ value: string; label: string }> =
  [{ value: NOT_SET, label: "—" }, ...FLAG_OPTIONS.map((o) => ({ value: o.value, label: o.label }))];

/*
 * §6.7 marker pills — the "SLIGHTLY HIGH / LOW / CRITICAL" register from the
 * sketch. The 4-value flag enum (normal/low/high/critical) has no
 * slightly-vs-severely gradation, so the non-critical out-of-range flags carry
 * the softer "Slightly" wording and critical stands alone. `normal` and null
 * render no pill. (Interpretation flagged in decisions.md.)
 */
export const FLAG_PILL_LABEL: Record<string, string> = {
  low: "Slightly low",
  high: "Slightly high",
  critical: "Critical",
};

// §6.7 "amber △ warning glyph". `critical` rides `destructive` (red, alarm);
// the non-critical out-of-range flags ride the `--warning` (amber) token added
// 2026-06-16 (decisions.md) — the spec's softer "worth noting" register.
export const WARNING_GLYPH = "△";

export function isFlagged(flag: string | null): boolean {
  return flag !== null && flag !== "normal";
}

export function isCritical(flag: string | null): boolean {
  return flag === "critical";
}
