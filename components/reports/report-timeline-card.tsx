import Link from "next/link";

import { REPORT_TYPE_LABEL } from "@/components/reports/report-options";
import type { Report } from "@/db/schema";

/*
 * Report timeline card per design.md §6.6:1469 — date-anchored layout: date
 * column left (`APR / 12 / Sun`), dotted vertical separator, content right. The
 * card content is title + report type + linked-to context (visit, doctor) when
 * present. Whole card navigates to the report detail.
 *
 * No most-recent tint (§6.6:1443 applies it to Visits and Symptoms only) and no
 * content preview (the spec's report card shows title + type, not a body
 * excerpt — the body is the document text, surfaced on the detail page).
 *
 * `linkedVisitLabel` / `linkedDoctorLabel` are resolved in the page (denormalized
 * from the visit / doctor maps) and passed as plain strings — the card stays a
 * single whole-card anchor, so nested links to the visit/doctor are deferred
 * (same card-restructure carryover as the other timelines).
 */

interface ReportTimelineCardProps {
  patientId: string;
  report: Report;
  linkedVisitLabel: string | null;
  linkedDoctorLabel: string | null;
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

export function ReportTimelineCard({
  patientId,
  report,
  linkedVisitLabel,
  linkedDoctorLabel,
}: ReportTimelineCardProps) {
  const { month, day, weekday } = dateParts(report.reportDate);
  const typeLabel = report.reportType
    ? (REPORT_TYPE_LABEL[report.reportType] ?? report.reportType)
    : null;

  const linkedParts = [
    linkedVisitLabel ? `From visit · ${linkedVisitLabel}` : null,
    linkedDoctorLabel,
  ].filter((p): p is string => p !== null);

  return (
    <Link
      href={`/patient/${patientId}/reports/${report.id}`}
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
          <span className="truncate text-sm font-medium">{report.title}</span>
          {typeLabel ? (
            <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
              {typeLabel}
            </span>
          ) : null}
        </div>

        {linkedParts.length > 0 ? (
          <div className="mt-0.5 text-xs text-muted-foreground">
            {linkedParts.join(" · ")}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
