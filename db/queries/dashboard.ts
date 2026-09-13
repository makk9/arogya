import { and, desc, eq, lte } from "drizzle-orm";

import { db } from "@/db";
import {
  doctors,
  journalEntries,
  labReports,
  reports,
  symptomEpisodes,
  symptomTypes,
  visits,
  vitalReadings,
} from "@/db/schema";
import { displayDoctorName } from "@/lib/doctor-display";
import { formatVitalValue, READING_TYPE_LABEL } from "@/lib/vitals";
import { realReportsWhere } from "./report";

/*
 * Dashboard-only aggregates (§6.1): the RECENT TIMELINE card's cross-entity
 * event feed. Not a general activity log — a small fixed-size merge of the six
 * event entities' most recent rows, newest first. One LIMITed query per event
 * type (the same shape §6.6 timelines already run), merged and re-sorted in
 * memory; at the per-type LIMIT this is bounded and index-backed
 * (patient_id + date desc on every event table).
 *
 * Labels are composed here (not in the component) so this card and the agent
 * serializers can never disagree on how an event is named — same posture as
 * entity-links.ts. Hrefs mirror entity-links: each item deep-links to its
 * §6.7 detail page; vitals (no detail page) anchor into the grouped history
 * view (`/vitals#r-<id>`).
 */

export interface RecentActivityItem {
  type: "visit" | "lab" | "symptom" | "report" | "journal" | "vital";
  id: string;
  /** YYYY-MM-DD (date columns) or full ISO (timestamp columns) — sortable. */
  sortKey: string;
  /** The event's own date, for display. */
  date: Date;
  label: string;
  href: string;
}

// A midday UTC instant from a date-only column, so a YYYY-MM-DD renders as the
// same calendar day in any plausible display timezone.
function dateOnly(d: string): Date {
  return new Date(`${d}T12:00:00Z`);
}

export async function recentActivity(
  patientId: string,
  /** The patient-timezone current date (YYYY-MM-DD) — the recency cutoff. */
  today: string,
  limit = 8,
): Promise<RecentActivityItem[]> {
  const base = `/patient/${patientId}`;

  const [visitRows, labRows, symptomRows, reportRows, journalRows, vitalRows] =
    await Promise.all([
      db
        .select({
          id: visits.id,
          date: visits.visitDate,
          chiefComplaint: visits.chiefComplaint,
          doctorName: doctors.name,
        })
        .from(visits)
        .leftJoin(doctors, eq(visits.doctorId, doctors.id))
        // Only visits that happened: a scheduled (future) visit isn't recent
        // activity, and cancelled / no-show ones never took place. Filtered in
        // SQL so upcoming visits can't eat the per-type LIMIT.
        .where(
          and(
            eq(visits.patientId, patientId),
            eq(visits.status, "completed"),
            lte(visits.visitDate, today),
          ),
        )
        .orderBy(desc(visits.visitDate))
        .limit(limit),
      db
        .select({
          id: labReports.id,
          date: labReports.reportDate,
          reportType: labReports.reportType,
          labName: labReports.labName,
        })
        .from(labReports)
        .where(eq(labReports.patientId, patientId))
        .orderBy(desc(labReports.reportDate))
        .limit(limit),
      db
        .select({
          id: symptomEpisodes.id,
          startedAt: symptomEpisodes.startedAt,
          typeName: symptomTypes.name,
        })
        .from(symptomEpisodes)
        .innerJoin(symptomTypes, eq(symptomEpisodes.symptomTypeId, symptomTypes.id))
        .where(eq(symptomEpisodes.patientId, patientId))
        .orderBy(desc(symptomEpisodes.startedAt))
        .limit(limit),
      db
        .select({ id: reports.id, date: reports.reportDate, title: reports.title })
        .from(reports)
        .where(realReportsWhere(patientId))
        .orderBy(desc(reports.reportDate))
        .limit(limit),
      db
        .select({
          id: journalEntries.id,
          date: journalEntries.entryDate,
          title: journalEntries.title,
        })
        .from(journalEntries)
        .where(eq(journalEntries.patientId, patientId))
        .orderBy(desc(journalEntries.entryDate))
        .limit(limit),
      db
        .select()
        .from(vitalReadings)
        .where(eq(vitalReadings.patientId, patientId))
        .orderBy(desc(vitalReadings.recordedAt))
        .limit(limit),
    ]);

  const items: RecentActivityItem[] = [
    ...visitRows.map((r): RecentActivityItem => ({
      type: "visit",
      id: r.id,
      sortKey: r.date,
      date: dateOnly(r.date),
      label: r.doctorName
        ? `Visit — ${displayDoctorName(r.doctorName)}`
        : (r.chiefComplaint ?? "Visit"),
      href: `${base}/visits/${r.id}`,
    })),
    ...labRows.map((r): RecentActivityItem => ({
      type: "lab",
      id: r.id,
      sortKey: r.date,
      date: dateOnly(r.date),
      label: `Lab report${r.reportType ? ` — ${r.reportType}` : r.labName ? ` — ${r.labName}` : ""}`,
      href: `${base}/labs/${r.id}`,
    })),
    ...symptomRows.map((r): RecentActivityItem => ({
      type: "symptom",
      id: r.id,
      sortKey: r.startedAt.toISOString(),
      date: r.startedAt,
      label: `${r.typeName} episode`,
      href: `${base}/symptoms/${r.id}`,
    })),
    ...reportRows.map((r): RecentActivityItem => ({
      type: "report",
      id: r.id,
      sortKey: r.date,
      date: dateOnly(r.date),
      label: r.title,
      href: `${base}/reports/${r.id}`,
    })),
    ...journalRows.map((r): RecentActivityItem => ({
      type: "journal",
      id: r.id,
      sortKey: r.date,
      date: dateOnly(r.date),
      label: r.title ?? "Journal entry",
      href: `${base}/journal/${r.id}`,
    })),
    ...vitalRows.map((r): RecentActivityItem => ({
      type: "vital",
      id: r.id,
      sortKey: r.recordedAt.toISOString(),
      date: r.recordedAt,
      label: `${READING_TYPE_LABEL[r.readingType]} ${formatVitalValue(r)}`,
      href: `${base}/vitals#r-${r.id}`,
    })),
  ];

  // Future-dated events (a scheduled visit) are not "recent" — without this
  // cutoff they'd lead the card and drive a nonsensical "last activity in 2
  // months" header. Same posture as atAGlance's inclusive visits window.
  // `${today}~` sorts after every same-day key of either shape ("~" > "T" and
  // > any date suffix), so today's events — date-only or timestamped — stay in.
  const cutoff = `${today}~`;

  // Date-only sortKeys (YYYY-MM-DD) and ISO timestamps compare correctly as
  // strings within each kind; across kinds a date-only key sorts before any
  // same-day timestamp, which is fine at day granularity for this card.
  return items
    .filter((i) => i.sortKey <= cutoff)
    .sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1))
    .slice(0, limit);
}
