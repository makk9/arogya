import Link from "next/link";
import { notFound } from "next/navigation";

import { AskAiButton } from "@/components/ask-ai-button";
import { buttonVariants } from "@/components/ui/button";
import { TimelineShowEarlier } from "@/components/visits/timeline-show-earlier";
import { VisitEmptyState } from "@/components/visits/visit-empty-state";
import { VisitFilters } from "@/components/visits/visit-filters";
import { VisitTimelineCard } from "@/components/visits/visit-timeline-card";
import {
  buildOutcomeItems,
  type OutcomeItem,
} from "@/components/visits/visit-outcome-model";
import { doctorQueries } from "@/db/queries/doctor";
import { visitQueries, type VisitOutcomes } from "@/db/queries/visit";
import type { Doctor, Visit } from "@/db/schema";
import { getCurrentPatient } from "@/lib/auth";
import { VISITS_LIST_SURFACE } from "@/lib/chat/surface-context";
import {
  formatRelativeDate,
  todayLocal,
  formatAbsoluteDate,
} from "@/lib/datetime";

/*
 * Visits timeline per the §6.6 event-timeline template — the template's first
 * implementation (proves it for Labs / Symptoms / Reports / Journal). Time is
 * the organizing axis: month-grouped sections (`APRIL 2026 · 3 visits`),
 * reverse chronological, date-anchored cards. Server component; client islands
 * for the doctor filter and the "Show N earlier" reveal.
 *
 * Result badges are denormalized in one pass: outcomesForPatient() fetches all
 * visit-linked med changes / labs / reports, grouped by visit here.
 */

// §6.6 wants "Show N earlier visits ▾", not infinite scroll. Whole months are
// kept together: sections render until at least this many visits are visible,
// the remaining months go behind the reveal.
const VISIBLE_TARGET = 10;

interface MonthSection {
  key: string; // YYYY-MM
  label: string; // APRIL 2026
  visits: Visit[];
}

const MONTH_LABEL_FMT = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

function monthSections(visits: Visit[]): MonthSection[] {
  const sections: MonthSection[] = [];
  for (const v of visits) {
    const key = v.visitDate.slice(0, 7);
    let section = sections[sections.length - 1];
    if (!section || section.key !== key) {
      const [y, m] = key.split("-").map(Number);
      section = {
        key,
        label: MONTH_LABEL_FMT.format(new Date(y, m - 1, 1)).toUpperCase(),
        visits: [],
      };
      sections.push(section);
    }
    section.visits.push(v);
  }
  return sections;
}

function groupOutcomesByVisit(all: VisitOutcomes): Map<string, VisitOutcomes> {
  const byVisit = new Map<string, VisitOutcomes>();
  const get = (visitId: string): VisitOutcomes => {
    let entry = byVisit.get(visitId);
    if (!entry) {
      entry = { medChanges: [], labReports: [], reports: [] };
      byVisit.set(visitId, entry);
    }
    return entry;
  };
  for (const mc of all.medChanges) {
    if (mc.change.linkedVisitId) get(mc.change.linkedVisitId).medChanges.push(mc);
  }
  for (const lab of all.labReports) {
    if (lab.linkedVisitId) get(lab.linkedVisitId).labReports.push(lab);
  }
  for (const report of all.reports) {
    if (report.linkedVisitId) get(report.linkedVisitId).reports.push(report);
  }
  return byVisit;
}

function pickFirst(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function VisitsTimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  const [allVisits, doctors, allOutcomes] = await Promise.all([
    visitQueries.forPatient(patient.patientId),
    doctorQueries.forPatient(patient.patientId),
    visitQueries.outcomesForPatient(patient.patientId),
  ]);

  const doctorMap = new Map<string, Doctor>(doctors.map((d) => [d.id, d]));
  const validDoctorIds = new Set(doctors.map((d) => d.id));

  const sp = await searchParams;
  const rawDoctor = pickFirst(sp.doctor);
  const doctorFilter =
    rawDoctor && validDoctorIds.has(rawDoctor) ? rawDoctor : null;

  const filtered = doctorFilter
    ? allVisits.filter((v) => v.doctorId === doctorFilter)
    : allVisits;

  // Outcome badges per visit.
  const outcomesByVisit = groupOutcomesByVisit(allOutcomes);
  const itemsForVisit = (v: Visit): OutcomeItem[] => {
    const outcomes = outcomesByVisit.get(v.id);
    return outcomes ? buildOutcomeItems(outcomes, patient.patientId) : [];
  };

  // Subtitle facts — computed from the full set, not the filtered view (the
  // title count is also absolute; same asymmetry as the state lists).
  const today = todayLocal();
  // 90-day cutoff in the SAME browser-local basis as `today` (not UTC) —
  // `new Date().toISOString()` would put the bound a day off for evening-US
  // sessions, miscounting a visit at the ~90-day edge. `Date(y, m, d-90)` rolls
  // back across month/year boundaries correctly.
  const ref = new Date();
  const cutoff = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 90);
  const cutoff90Str = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;

  const pastVisits = allVisits.filter((v) => v.visitDate <= today);
  const last90 = pastVisits.filter((v) => v.visitDate >= cutoff90Str).length;
  const distinctDoctors = new Set(allVisits.map((v) => v.doctorId)).size;
  const mostRecentPast = pastVisits[0];
  // §4:357 — `scheduled` enables "next visit on Friday". Earliest future one,
  // found by min so it doesn't silently depend on the query's sort order.
  const futureScheduled = allVisits.filter(
    (v) => v.status === "scheduled" && v.visitDate > today,
  );
  const nextScheduled =
    futureScheduled.length > 0
      ? futureScheduled.reduce((min, v) =>
          v.visitDate < min.visitDate ? v : min,
        )
      : undefined;

  const subtitleParts: string[] = [];
  if (last90 > 0) subtitleParts.push(`${last90} in last 90 days`);
  if (distinctDoctors > 0) {
    subtitleParts.push(
      `${distinctDoctors} ${distinctDoctors === 1 ? "doctor" : "doctors"}`,
    );
  }
  if (mostRecentPast) {
    subtitleParts.push(`most recent ${formatRelativeDate(mostRecentPast.visitDate)}`);
  }
  if (nextScheduled) {
    subtitleParts.push(`next ${formatAbsoluteDate(nextScheduled.visitDate)}`);
  }

  // The §6.6 most-recent tint marks "where we are now". Derived from the
  // FILTERED view, not the full set: when narrowed to one doctor, the most
  // recent visit *with that doctor* gets the tint — otherwise filtering out the
  // global-latest visit would leave no card highlighted at all. `filtered` is
  // still date-desc (filtered from the desc query), so the first past visit is
  // the most recent in view.
  const mostRecentId = filtered.find((v) => v.visitDate <= today)?.id ?? null;

  // Whole-month pagination split.
  const sections = monthSections(filtered);
  const visibleSections: MonthSection[] = [];
  const earlierSections: MonthSection[] = [];
  let visibleCount = 0;
  for (const section of sections) {
    if (visibleCount < VISIBLE_TARGET) {
      visibleSections.push(section);
      visibleCount += section.visits.length;
    } else {
      earlierSections.push(section);
    }
  }
  const earlierCount = earlierSections.reduce(
    (n, s) => n + s.visits.length,
    0,
  );

  function renderSection(section: MonthSection) {
    return (
      <section key={section.key}>
        <h2 className="font-mono text-[0.7rem] uppercase tracking-wide text-muted-foreground">
          {section.label} · {section.visits.length}{" "}
          {section.visits.length === 1 ? "visit" : "visits"}
        </h2>
        <div className="mt-3 flex flex-col gap-2">
          {section.visits.map((v) => (
            <VisitTimelineCard
              key={v.id}
              patientId={patient.patientId}
              visit={v}
              doctor={doctorMap.get(v.doctorId)}
              outcomes={itemsForVisit(v)}
              mostRecent={v.id === mostRecentId}
            />
          ))}
        </div>
      </section>
    );
  }

  const totalCount = allVisits.length;
  const filteredCount = filtered.length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <nav
        aria-label="breadcrumb"
        className="mb-6 font-mono text-xs text-muted-foreground"
      >
        / patient / {id.slice(0, 8)}… / visits
      </nav>

      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold leading-tight">
          <span className="border-b-2 border-destructive pb-1">Visits</span>
          {totalCount > 0 ? (
            <span className="ml-2 text-muted-foreground">· {totalCount}</span>
          ) : null}
        </h1>
        <Link href={`/patient/${id}/visits/new`} className={buttonVariants()}>
          + Log visit
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
          <VisitFilters
            doctors={doctors.map((d) => ({ id: d.id, name: d.name }))}
          />
        </div>
      ) : null}

      {totalCount === 0 ? (
        <VisitEmptyState patientId={patient.patientId} />
      ) : filteredCount === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
          No visits with this doctor.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {visibleSections.map(renderSection)}
          {earlierSections.length > 0 ? (
            <TimelineShowEarlier hiddenCount={earlierCount} noun="visits">
              <div className="flex flex-col gap-6">
                {earlierSections.map(renderSection)}
              </div>
            </TimelineShowEarlier>
          ) : null}
        </div>
      )}

      <AskAiButton surfaceContext={VISITS_LIST_SURFACE} />
    </main>
  );
}
