"use client";

import { useEffect, useRef, useState } from "react";

import { LabCorrectionDialog } from "@/components/labs/lab-correction-dialog";
import { isCritical, isFlagged } from "@/components/labs/lab-options";
import {
  MarkerFlagPill,
  formatMarkerValue,
  formatReferenceRange,
} from "@/components/labs/marker-display";
import type { LabResult } from "@/db/schema";
import { cn } from "@/lib/utils";

/*
 * §6.7 body section for a lab report: the MARKERS table. Read-only — corrections
 * route through the `+ Log a correction` dashed affordance (this is what
 * visually communicates "rare amendment, not primary edit"), never inline edit.
 * Columns: Marker · Value · Reference range · Flag. All markers shown; flagged
 * rows use the △ pill and a soft tint. Anchored `#markers` so the Outcomes
 * "View flagged markers ↑" link scrolls here; that link also fires the
 * `FLASH_MARKERS_EVENT` window event, which briefly pulses the flagged rows to
 * a stronger tint and fades them back (§6.7:1552 — highlight, don't filter).
 */

// Window event the Outcomes "View flagged markers ↑" link dispatches to pulse
// the flagged rows. Decoupled via the event so the (server-rendered) Outcomes
// section and this client table don't need a shared parent state.
export const FLASH_MARKERS_EVENT = "arogya:flash-markers";

interface Props {
  reportId: string;
  results: ReadonlyArray<LabResult>;
}

const HEAD_CLASS =
  "pb-2 text-left font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground";

export function LabMarkersSection({ reportId, results }: Props) {
  const [correctionOpen, setCorrectionOpen] = useState(false);
  // `flashing` snaps flagged rows to a stronger tint; clearing it fades them
  // back over ~1s (the transition class is only present while not flashing).
  const [flashing, setFlashing] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onFlash() {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      setFlashing(true);
      flashTimer.current = setTimeout(() => setFlashing(false), 1200);
    }
    window.addEventListener(FLASH_MARKERS_EVENT, onFlash);
    return () => {
      window.removeEventListener(FLASH_MARKERS_EVENT, onFlash);
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  return (
    <section id="markers" className="mb-8 scroll-mt-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          Markers
        </h2>
        {results.length > 0 ? (
          <button
            type="button"
            onClick={() => setCorrectionOpen(true)}
            className="rounded-md border border-dashed border-border px-2.5 py-1 font-mono text-[0.7rem] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            + Log a correction
          </button>
        ) : null}
      </div>

      {results.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No markers recorded on this report.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className={cn(HEAD_CLASS, "pl-4")}>Marker</th>
                <th className={HEAD_CLASS}>Value</th>
                <th className={HEAD_CLASS}>Reference range</th>
                <th className={cn(HEAD_CLASS, "pr-4")}>Flag</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const range = formatReferenceRange(r);
                const flagged = isFlagged(r.flag);
                return (
                  <tr
                    key={r.id}
                    className={cn(
                      "border-b border-border last:border-b-0",
                      // Severity-tinted: critical rows red, slightly high/low amber.
                      // While `flashing`, snap to a stronger tint (no transition);
                      // otherwise keep the base tint + a slow transition so the
                      // flash fades back when `flashing` clears.
                      flagged &&
                        (flashing
                          ? isCritical(r.flag)
                            ? "bg-destructive/20"
                            : "bg-warning/30"
                          : cn(
                              isCritical(r.flag)
                                ? "bg-destructive/5"
                                : "bg-warning/10",
                              "transition-colors duration-1000",
                            )),
                    )}
                  >
                    <td className="py-2.5 pl-4 pr-3 font-medium">{r.marker}</td>
                    <td className="py-2.5 pr-3 font-mono">
                      {formatMarkerValue(r)}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-muted-foreground">
                      {range ?? "—"}
                    </td>
                    <td className="py-2.5 pr-4">
                      {flagged ? <MarkerFlagPill flag={r.flag} /> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <LabCorrectionDialog
        reportId={reportId}
        results={results}
        open={correctionOpen}
        onOpenChange={setCorrectionOpen}
      />
    </section>
  );
}
