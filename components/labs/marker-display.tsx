import {
  FLAG_PILL_LABEL,
  WARNING_GLYPH,
  isCritical,
  isFlagged,
} from "@/components/labs/lab-options";
import type { LabResult } from "@/db/schema";
import { cn } from "@/lib/utils";

/*
 * Shared marker presentation — the §6.7 MARKERS table and the §6.6 timeline-card
 * preview both render values, ranges, and the flag pill the same way. Pure /
 * presentational (no hooks), safe in server components.
 */

type ValueFields = Pick<
  LabResult,
  "value" | "valueText" | "unit" | "referenceLow" | "referenceHigh"
>;

/** "1.4 mg/dL" / "Positive" / "—". valueText (qualitative) wins over value. */
export function formatMarkerValue(r: ValueFields): string {
  const v = r.valueText ?? r.value;
  if (v === null) return "—";
  return r.unit ? `${v} ${r.unit}` : v;
}

/** "0.7–1.3" / "≤ 1.3" / "≥ 0.7" / null when no range on the report. */
export function formatReferenceRange(r: ValueFields): string | null {
  if (r.referenceLow === null && r.referenceHigh === null) return null;
  if (r.referenceLow !== null && r.referenceHigh !== null) {
    return `${r.referenceLow}–${r.referenceHigh}`;
  }
  if (r.referenceHigh !== null) return `≤ ${r.referenceHigh}`;
  return `≥ ${r.referenceLow}`;
}

/*
 * §6.7 flag pill — amber △ warning glyph and HIGH / LOW / CRITICAL labels
 * (clinical H/L + panic-tier convention; "Slightly" wording dropped 2026-06-28,
 * decisions.md). `critical` rides the `destructive` (red) register — a genuine
 * alarm; the non-critical out-of-range flags ride the `--warning` (amber) token,
 * the spec's "worth noting" register (added 2026-06-16, decisions.md). normal /
 * null render nothing.
 */
export function MarkerFlagPill({
  flag,
  className,
}: {
  flag: string | null;
  className?: string;
}) {
  if (!isFlagged(flag)) return null;
  const label = FLAG_PILL_LABEL[flag as string] ?? flag;
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 rounded-full px-2 py-0.5 font-mono text-[0.7rem] uppercase tracking-wide",
        isCritical(flag)
          ? "border border-destructive/40 bg-destructive/10 text-destructive"
          : "border border-warning/40 bg-warning/10 text-warning",
        className,
      )}
    >
      <span aria-hidden>{WARNING_GLYPH}</span>
      {label}
    </span>
  );
}
