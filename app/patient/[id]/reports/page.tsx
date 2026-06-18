import Link from "next/link";
import { notFound } from "next/navigation";

import { AskAiButton } from "@/components/ask-ai-button";
import { ReportEmptyState } from "@/components/reports/report-empty-state";
import { ReportFilters } from "@/components/reports/report-filters";
import { ReportTimelineCard } from "@/components/reports/report-timeline-card";
import { REPORT_TYPE_OPTIONS } from "@/components/reports/report-options";
import { TimelineShowEarlier } from "@/components/visits/timeline-show-earlier";
import { buttonVariants } from "@/components/ui/button";
import { doctorQueries } from "@/db/queries/doctor";
import { reportQueries } from "@/db/queries/report";
import { visitQueries } from "@/db/queries/visit";
import type { Doctor, Report, Visit } from "@/db/schema";
import { getCurrentPatient } from "@/lib/auth";
import { REPORTS_LIST_SURFACE } from "@/lib/chat/surface-context";
import { formatAbsoluteDate, formatRelativeDate } from "@/lib/datetime";
import { displayDoctorName } from "@/lib/doctor-display";

/*
 * Reports timeline per the §6.6 event-timeline template. Time is the organizing
 * axis: month-grouped sections (`APRIL 2026 · 3 reports`), reverse chronological,
 * date-anchored cards. Server component; client islands for the type filter and
 * the "Show N earlier" reveal.
 *
 * No most-recent tint (§6.6:1443 — Visits / Symptoms only) and no outcome badges
 * (those are Visit-specific, §6.6:1489). Linked visit / doctor labels are
 * denormalized here from the patient's visit / doctor maps.
 */

const VISIBLE_TARGET = 10;

const VALID_TYPES = new Set<string>(REPORT_TYPE_OPTIONS.map((o) => o.value));

interface MonthSection {
  key: string; // YYYY-MM
  label: string; // APRIL 2026
  reports: Report[];
}

const MONTH_LABEL_FMT = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

function monthSections(reports: Report[]): MonthSection[] {
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

function pickFirst(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReportsTimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  const [allReports, doctors, visits] = await Promise.all([
    reportQueries.forPatient(patient.patientId),
    doctorQueries.forPatient(patient.patientId),
    visitQueries.forPatient(patient.patientId),
  ]);

  const doctorMap = new Map<string, Doctor>(doctors.map((d) => [d.id, d]));
  const visitMap = new Map<string, Visit>(visits.map((v) => [v.id, v]));

  const sp = await searchParams;
  const rawType = pickFirst(sp.type);
  const typeFilter =
    rawType && VALID_TYPES.has(rawType)
      ? (rawType as Report["reportType"])
      : null;

  const filtered = typeFilter
    ? allReports.filter((r) => r.reportType === typeFilter)
    : allReports;

  // Linked-context labels for each card. Visit label = its doctor + date;
  // doctor label = the report's own linked doctor.
  function visitLabel(visitId: string | null): string | null {
    if (!visitId) return null;
    const v = visitMap.get(visitId);
    if (!v) return null;
    const d = doctorMap.get(v.doctorId);
    const who = d ? displayDoctorName(d.name) : "visit";
    return `${who} · ${formatAbsoluteDate(v.visitDate)}`;
  }
  function doctorLabel(doctorId: string | null): string | null {
    if (!doctorId) return null;
    const d = doctorMap.get(doctorId);
    return d ? displayDoctorName(d.name) : null;
  }

  // Subtitle facts.
  const totalCount = allReports.length;
  const distinctTypes = new Set(
    allReports.map((r) => r.reportType).filter((t) => t !== null),
  ).size;
  const mostRecent = allReports[0];

  const subtitleParts: string[] = [];
  if (distinctTypes > 0) {
    subtitleParts.push(
      `${distinctTypes} ${distinctTypes === 1 ? "type" : "types"}`,
    );
  }
  if (mostRecent) {
    subtitleParts.push(
      `most recent ${formatRelativeDate(mostRecent.reportDate)}`,
    );
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
            <ReportTimelineCard
              key={r.id}
              patientId={patient.patientId}
              report={r}
              linkedVisitLabel={visitLabel(r.linkedVisitId)}
              linkedDoctorLabel={doctorLabel(r.linkedDoctorId)}
            />
          ))}
        </div>
      </section>
    );
  }

  const filteredCount = filtered.length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <nav
        aria-label="breadcrumb"
        className="mb-6 font-mono text-xs text-muted-foreground"
      >
        / patient / {id.slice(0, 8)}… / reports
      </nav>

      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold leading-tight">
          <span className="border-b-2 border-destructive pb-1">Reports</span>
          {totalCount > 0 ? (
            <span className="ml-2 text-muted-foreground">· {totalCount}</span>
          ) : null}
        </h1>
        <Link href={`/patient/${id}/reports/new`} className={buttonVariants()}>
          + Log report
        </Link>
      </div>

      {subtitleParts.length > 0 ? (
        <p className="mb-6 text-sm text-muted-foreground">
          {subtitleParts.join(" · ")}
        </p>
      ) : (
        <div className="mb-6" />
      )}

      {totalCount > 0 ? (
        <div className="mb-6 flex justify-end">
          <ReportFilters />
        </div>
      ) : null}

      {totalCount === 0 ? (
        <ReportEmptyState patientId={patient.patientId} />
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

      <AskAiButton surfaceContext={REPORTS_LIST_SURFACE} />
    </main>
  );
}
