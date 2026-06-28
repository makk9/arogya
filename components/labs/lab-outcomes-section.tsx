"use client";

import { FLASH_MARKERS_EVENT } from "@/components/labs/lab-markers-section";

/*
 * §6.7 Outcomes section for a lab report — "what came out of this report". For
 * labs that's the flagged-marker summary (`⚠ N markers flagged`) plus, in
 * Phase E, generated insights (warm-tinted). Insight generation is Phase E, so
 * v1 surfaces only the flagged count + a `View flagged markers ↑` link that
 * scrolls UP to the MARKERS table (§6.7 documented behavior — scroll, don't
 * filter, so normal markers stay visible alongside flagged ones) and briefly
 * pulses the flagged rows via FLASH_MARKERS_EVENT. The arrow points up (not →)
 * to signal same-page, not navigation.
 *
 * Parent omits the section when nothing flagged (events with no outcomes render
 * nothing, per the §6.5 omission rationale carried into §6.7).
 */

interface Props {
  flaggedCount: number;
  /** Of the flagged markers, how many are `critical` — drives the red register. */
  criticalCount: number;
}

export function LabOutcomesSection({ flaggedCount, criticalCount }: Props) {
  if (flaggedCount === 0) return null;

  // Worst-severity register: any critical marker → red (alarm); otherwise the
  // amber warning token (the summary spans all out-of-range markers, criticals
  // are differentiated per-row in the table).
  const critical = criticalCount > 0;
  const box = critical
    ? "border-destructive/30 bg-destructive/5"
    : "border-warning/30 bg-warning/10";
  const text = critical ? "text-destructive" : "text-warning";

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Outcomes
      </h2>
      <div
        className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${box}`}
      >
        <span className={`text-sm font-medium ${text}`}>
          {/* U+FE0E forces text (monochrome) presentation — without it the
              warning sign renders as a colored emoji that ignores the
              text color and the palette's no-stray-color rule. */}
          <span aria-hidden className="mr-1.5">
            {"⚠︎"}
          </span>
          {flaggedCount} {flaggedCount === 1 ? "marker" : "markers"} flagged
        </span>
        <a
          href="#markers"
          onClick={() => window.dispatchEvent(new CustomEvent(FLASH_MARKERS_EVENT))}
          className="shrink-0 text-xs text-link underline-offset-4 hover:underline"
        >
          View flagged markers <span aria-hidden>↑</span>
        </a>
      </div>
    </section>
  );
}
