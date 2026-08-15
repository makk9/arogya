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
 * §6.7 marker pills. Plain High / Low / Critical — matching clinical flag
 * convention (HL7 H/L for out-of-range, HH/LL/"critical" for the panic tier)
 * AND the create-form's own options (FLAG_OPTIONS), which the earlier "Slightly
 * high/low" wording silently diverged from. Magnitude isn't encoded in the flag
 * clinically — it's read from the value vs its reference range (shown in the
 * MARKERS table), and the amber-vs-red color already carries mild-vs-critical.
 * `normal` and null render no pill. (Wording change logged in decisions.md,
 * 2026-06-28; supersedes the sketch's literal "SLIGHTLY HIGH" at §6.7:1532.)
 */
export const FLAG_PILL_LABEL: Record<string, string> = {
  low: "Low",
  high: "High",
  critical: "Critical",
};

// §6.7 "amber △ warning glyph". `critical` rides `destructive` (red, alarm);
// the non-critical out-of-range flags ride the `--warning` (amber) token added
// 2026-06-16 (decisions.md) — the spec's softer "worth noting" register.
export const WARNING_GLYPH = "△";

// Canonical home is lib/labs.ts (server code uses them too — the chat
// surface-context resolver); re-exported here so option-list consumers keep a
// single import site.
export { isCritical, isFlagged } from "@/lib/labs";
