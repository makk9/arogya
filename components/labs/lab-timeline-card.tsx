import Link from "next/link";

import {
  MarkerFlagPill,
  formatMarkerValue,
} from "@/components/labs/marker-display";
import { isFlagged } from "@/components/labs/lab-options";
import type { LabReport, LabResult } from "@/db/schema";

/*
 * Lab report timeline card per design.md §6.6 — date column left
 * (`APR / 30 / Thu`), dotted separator, content right: report type + lab name
 * in the title row, then a 2-3 marker preview with flag indicators. Whole card
 * navigates to the lab detail.
 *
 * No most-recent tint: §6.6 applies the warm tint to Visits and Symptoms only
 * (skipped for Journal; labs aren't in the applied set). The flag pills carry
 * the clinical signal here instead.
 */

interface LabTimelineCardProps {
  patientId: string;
  report: LabReport;
  /** Up to ~3 markers, flagged-first (trimmed by the page). */
  previewMarkers: LabResult[];
  /** Total marker count on the report (for the "+N more" affordance). */
  markerCount: number;
}

const WEEKDAY_FMT = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short" });

function dateParts(isoDate: string): {
  month: string;
  day: string;
  weekday: string;
} {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return {
    month: MONTH_FMT.format(date).toUpperCase(),
    day: String(d),
    weekday: WEEKDAY_FMT.format(date),
  };
}

export function LabTimelineCard({
  patientId,
  report,
  previewMarkers,
  markerCount,
}: LabTimelineCardProps) {
  const { month, day, weekday } = dateParts(report.reportDate);
  const title = report.reportType ?? report.labName ?? "Lab report";
  const subtitle =
    report.reportType && report.labName ? report.labName : null;
  const moreCount = markerCount - previewMarkers.length;

  return (
    <Link
      href={`/patient/${patientId}/labs/${report.id}`}
      className="flex gap-4 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-foreground/30 hover:bg-muted/40"
    >
      <div className="flex w-10 shrink-0 flex-col items-center pt-0.5 text-center">
        <span className="font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">
          {month}
        </span>
        <span className="font-heading text-lg font-semibold leading-tight">
          {day}
        </span>
        <span className="font-mono text-[0.65rem] text-muted-foreground">
          {weekday}
        </span>
      </div>

      <div
        aria-hidden
        className="w-0 self-stretch border-l border-dotted border-border"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-medium">
            {title}
            {subtitle ? (
              <span className="text-muted-foreground"> · {subtitle}</span>
            ) : null}
          </span>
          <span className="shrink-0 font-mono text-[0.65rem] text-muted-foreground">
            {markerCount} {markerCount === 1 ? "marker" : "markers"}
          </span>
        </div>

        {previewMarkers.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {previewMarkers.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-baseline gap-1.5 rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-[0.7rem] text-muted-foreground"
              >
                <span className="text-foreground">{m.marker}</span>
                <span>{formatMarkerValue(m)}</span>
                {isFlagged(m.flag) ? <MarkerFlagPill flag={m.flag} /> : null}
              </span>
            ))}
            {moreCount > 0 ? (
              <span className="font-mono text-[0.7rem] text-muted-foreground">
                +{moreCount} more
              </span>
            ) : null}
          </div>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            No markers recorded.
          </p>
        )}
      </div>
    </Link>
  );
}
