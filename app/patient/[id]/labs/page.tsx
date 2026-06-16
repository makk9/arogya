import Link from "next/link";
import { notFound } from "next/navigation";

import { AskAiButton } from "@/components/ask-ai-button";
import { LabEmptyState } from "@/components/labs/lab-empty-state";
import { LabFilters } from "@/components/labs/lab-filters";
import { LabTimelineCard } from "@/components/labs/lab-timeline-card";
import { isFlagged, isCritical } from "@/components/labs/lab-options";
import { buttonVariants } from "@/components/ui/button";
import { TimelineShowEarlier } from "@/components/visits/timeline-show-earlier";
import { labReportQueries, labResultQueries } from "@/db/queries/lab";
import type { LabReport, LabResult } from "@/db/schema";
import { getCurrentPatient } from "@/lib/auth";
import { LABS_LIST_SURFACE } from "@/lib/chat/surface-context";
import { formatRelativeDate, todayLocal } from "@/lib/datetime";

/*
 * Labs timeline per the §6.6 event-timeline template — month-grouped sections
 * (`APRIL 2026 · 3 reports`), reverse chronological, date-anchored cards. Time
 * is the organizing axis. Server component; client islands for the report-type
 * filter and the "Show N earlier" reveal.
 *
 * Each card previews up to 3 markers (flagged-first); all results are fetched
 * once and grouped by report here — v1 scale is one patient's history.
 */

const VISIBLE_TARGET = 10;
const PREVIEW_MARKERS = 3;

interface MonthSection {
  key: string;
  label: string;
  reports: LabReport[];
}

const MONTH_LABEL_FMT = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

function monthSections(reports: LabReport[]): MonthSection[] {
  const sections: MonthSection[] = [];
  for (const r of reports) {
    const key = r.reportDate.slice(0, 7);
    let section = sections[sections.length - 1];
    if (!section || section.key !== key) {
      const [y, m] = key.split("-").map(Number);
      section = {
        key,
        label: MONTH_LABEL_FMT.format(new Date(y, m - 1, 1)).toUpperCase(),
        reports: [],
      };
      sections.push(section);
    }
    section.reports.push(r);
  }
  return sections;
}

// Flagged-first ordering for the card preview: critical, then high/low, then
// normal/unflagged — surfacing the clinically loud markers in the 3-slot window.
function flagWeight(flag: string | null): number {
  if (isCritical(flag)) return 0;
  if (isFlagged(flag)) return 1;
  return 2;
}

function pickFirst(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LabsTimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  const [allReports, allResults, reportTypes] = await Promise.all([
    labReportQueries.forPatient(patient.patientId),
    labResultQueries.forPatient(patient.patientId),
    labReportQueries.distinctReportTypes(patient.patientId),
  ]);

  // Group results by report; build a flagged-first preview subset per report.
  const resultsByReport = new Map<string, LabResult[]>();
  for (const res of allResults) {
    const list = resultsByReport.get(res.labReportId) ?? [];
    list.push(res);
    resultsByReport.set(res.labReportId, list);
  }
  const previewFor = (reportId: string): LabResult[] => {
    const all = resultsByReport.get(reportId) ?? [];
    return all
      .slice()
      .sort((a, b) => flagWeight(a.flag) - flagWeight(b.flag))
      .slice(0, PREVIEW_MARKERS);
  };
  const markerCountFor = (reportId: string): number =>
    resultsByReport.get(reportId)?.length ?? 0;

  const sp = await searchParams;
  const rawType = pickFirst(sp.type);
  const typeFilter =
    rawType && reportTypes.includes(rawType) ? rawType : null;

  const filtered = typeFilter
    ? allReports.filter((r) => r.reportType === typeFilter)
    : allReports;

  // Subtitle facts — from the full set (title count is also absolute).
  const today = todayLocal();
  const ref = new Date();
  const cutoff = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 90);
  const cutoff90Str = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;

  const pastReports = allReports.filter((r) => r.reportDate <= today);
  const last90 = pastReports.filter((r) => r.reportDate >= cutoff90Str).length;
  const mostRecent = pastReports[0];

  const subtitleParts: string[] = [];
  if (last90 > 0) subtitleParts.push(`${last90} in last 90 days`);
  if (reportTypes.length > 0) {
    subtitleParts.push(
      `${reportTypes.length} report ${reportTypes.length === 1 ? "type" : "types"}`,
    );
  }
  if (mostRecent) {
    subtitleParts.push(`most recent ${formatRelativeDate(mostRecent.reportDate)}`);
  }

  // Whole-month pagination split.
  const sections = monthSections(filtered);
  const visibleSections: MonthSection[] = [];
  const earlierSections: MonthSection[] = [];
  let visibleCount = 0;
  for (const section of sections) {
    if (visibleCount < VISIBLE_TARGET) {
      visibleSections.push(section);
      visibleCount += section.reports.length;
    } else {
      earlierSections.push(section);
    }
  }
  const earlierCount = earlierSections.reduce((n, s) => n + s.reports.length, 0);

  function renderSection(section: MonthSection) {
    return (
      <section key={section.key}>
        <h2 className="font-mono text-[0.7rem] uppercase tracking-wide text-muted-foreground">
          {section.label} · {section.reports.length}{" "}
          {section.reports.length === 1 ? "report" : "reports"}
        </h2>
        <div className="mt-3 flex flex-col gap-2">
          {section.reports.map((r) => (
            <LabTimelineCard
              key={r.id}
              patientId={patient.patientId}
              report={r}
              previewMarkers={previewFor(r.id)}
              markerCount={markerCountFor(r.id)}
            />
          ))}
        </div>
      </section>
    );
  }

  const totalCount = allReports.length;
  const filteredCount = filtered.length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <nav
        aria-label="breadcrumb"
        className="mb-6 font-mono text-xs text-muted-foreground"
      >
        / patient / {id.slice(0, 8)}… / labs
      </nav>

      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold leading-tight">
          <span className="border-b-2 border-destructive pb-1">Labs</span>
          {totalCount > 0 ? (
            <span className="ml-2 text-muted-foreground">· {totalCount}</span>
          ) : null}
        </h1>
        <Link href={`/patient/${id}/labs/new`} className={buttonVariants()}>
          + Log lab report
        </Link>
      </div>

      {subtitleParts.length > 0 ? (
        <p className="mb-6 text-sm text-muted-foreground">
          {subtitleParts.join(" · ")}
        </p>
      ) : (
        <div className="mb-6" />
      )}

      {totalCount > 0 && reportTypes.length > 0 ? (
        <div className="mb-6 flex justify-end">
          <LabFilters reportTypes={reportTypes} />
        </div>
      ) : null}

      {totalCount === 0 ? (
        <LabEmptyState patientId={patient.patientId} />
      ) : filteredCount === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
          No reports of this type.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {visibleSections.map(renderSection)}
          {earlierSections.length > 0 ? (
            <TimelineShowEarlier hiddenCount={earlierCount} noun="reports">
              <div className="flex flex-col gap-6">
                {earlierSections.map(renderSection)}
              </div>
            </TimelineShowEarlier>
          ) : null}
        </div>
      )}

      <AskAiButton surfaceContext={LABS_LIST_SURFACE} />
    </main>
  );
}
