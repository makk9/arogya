import { and, count, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  conditions,
  doctors,
  familyHistory,
  insights,
  journalEntries,
  labReports,
  medications,
  reports,
  symptomTypes,
  visits,
} from "@/db/schema";
import { realReportsWhere } from "./report";

/**
 * Per-category row counts for the Health Wiki rail (§3 rail structure +
 * §6.1:1146 "nine category items + counts"). One count() per category; the
 * Symptoms item counts symptom *types* (the index unit — episodes nest under a
 * type on the timeline), Labs counts lab *reports* (results nest under a
 * report). Single-patient scale, so nine cheap aggregates per navigation is
 * fine; patient-scoped throughout.
 *
 * These stay nine separate `count()`s rather than the single `COUNT(*) OVER()`
 * pass the patient profile's `atAGlance` uses (decisions.md F1) — that one also
 * pulls preview rows per entity, so collapsing waves paid off there; here we
 * need counts only, and nine parallel aggregates are one round-trip.
 */
export interface WikiCounts {
  medications: number;
  conditions: number;
  doctors: number;
  familyHistory: number;
  visits: number;
  labs: number;
  symptoms: number;
  reports: number;
  journal: number;
  // Unread indicator for the rail's Insights item — insights still in status
  // `new` (§4:583 lifecycle). Cleared by the feed's seen-transition.
  insightsNew: number;
}

async function countFor(
  table:
    | typeof medications
    | typeof conditions
    | typeof doctors
    | typeof familyHistory
    | typeof visits
    | typeof labReports
    | typeof symptomTypes
    | typeof reports
    | typeof journalEntries,
  patientId: string,
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(table)
    .where(eq(table.patientId, patientId));
  return row?.c ?? 0;
}

// Reports need the stub-excluding filter (§5.4 quick-log source stubs), so the
// rail badge matches the §6.6 timeline exactly — not a plain row count.
async function countRealReports(patientId: string): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(reports)
    .where(realReportsWhere(patientId));
  return row?.c ?? 0;
}

async function countNewInsights(patientId: string): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(insights)
    .where(and(eq(insights.patientId, patientId), eq(insights.status, "new")));
  return row?.c ?? 0;
}

export async function wikiCounts(patientId: string): Promise<WikiCounts> {
  const [
    medicationsCount,
    conditionsCount,
    doctorsCount,
    familyHistoryCount,
    visitsCount,
    labsCount,
    symptomsCount,
    reportsCount,
    journalCount,
    insightsNewCount,
  ] = await Promise.all([
    countFor(medications, patientId),
    countFor(conditions, patientId),
    countFor(doctors, patientId),
    countFor(familyHistory, patientId),
    countFor(visits, patientId),
    countFor(labReports, patientId),
    countFor(symptomTypes, patientId),
    countRealReports(patientId),
    countFor(journalEntries, patientId),
    countNewInsights(patientId),
  ]);

  return {
    medications: medicationsCount,
    conditions: conditionsCount,
    doctors: doctorsCount,
    familyHistory: familyHistoryCount,
    visits: visitsCount,
    labs: labsCount,
    symptoms: symptomsCount,
    reports: reportsCount,
    journal: journalCount,
    insightsNew: insightsNewCount,
  };
}
