import { and, eq, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  allergies,
  conditions,
  doctors,
  familyHistory,
  insights,
  journalEntries,
  labReports,
  medications,
  patients,
  reports,
  symptomTypes,
  visits,
  vitalReadings,
} from "@/db/schema";
import { realReportsWhere } from "./report";

/**
 * Per-category row counts for the Health Wiki rail. §3 spec'd nine items;
 * Allergies + Vitals were promoted 2026-08-12 (user sign-off, decisions.md —
 * "if it has a page, it's in the rail"; Lifestyle joined too but is a
 * countless singleton). The Symptoms item counts symptom *types* (the index
 * unit — episodes nest under a type on the timeline), Labs counts lab
 * *reports* (results nest under a report), Vitals counts readings.
 *
 * One round-trip: the query anchors on the patient row and computes every
 * count as a scalar subquery — the rail renders on every navigation, so a
 * dozen sequential-ish pool checkouts per click was the wrong shape
 * (2026-08-12 /check). Missing patient degrades to all-zeros.
 */
export interface WikiCounts {
  medications: number;
  conditions: number;
  allergies: number;
  doctors: number;
  familyHistory: number;
  visits: number;
  labs: number;
  vitals: number;
  symptoms: number;
  reports: number;
  journal: number;
  // Unread indicator for the rail's Insights item — insights still in status
  // `new` (§4:583 lifecycle). Cleared by the feed's seen-transition.
  insightsNew: number;
}

// A correlated `(select count(*) …)` scalar, coerced from postgres-js's
// string-typed bigint.
function countWhere(table: PgTable, where: SQL | undefined) {
  return sql<number>`(select count(*) from ${table} where ${where})`.mapWith(
    Number,
  );
}

export async function wikiCounts(patientId: string): Promise<WikiCounts> {
  const rows = await db
    .select({
      medications: countWhere(medications, eq(medications.patientId, patients.id)),
      conditions: countWhere(conditions, eq(conditions.patientId, patients.id)),
      allergies: countWhere(allergies, eq(allergies.patientId, patients.id)),
      doctors: countWhere(doctors, eq(doctors.patientId, patients.id)),
      familyHistory: countWhere(familyHistory, eq(familyHistory.patientId, patients.id)),
      visits: countWhere(visits, eq(visits.patientId, patients.id)),
      labs: countWhere(labReports, eq(labReports.patientId, patients.id)),
      vitals: countWhere(vitalReadings, eq(vitalReadings.patientId, patients.id)),
      symptoms: countWhere(symptomTypes, eq(symptomTypes.patientId, patients.id)),
      // Reports keep the stub-excluding filter (§5.4 quick-log source stubs)
      // so the badge matches the §6.6 timeline exactly.
      reports: countWhere(reports, realReportsWhere(patientId)),
      journal: countWhere(journalEntries, eq(journalEntries.patientId, patients.id)),
      insightsNew: countWhere(
        insights,
        and(eq(insights.patientId, patients.id), eq(insights.status, "new")),
      ),
    })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  return (
    rows[0] ?? {
      medications: 0,
      conditions: 0,
      allergies: 0,
      doctors: 0,
      familyHistory: 0,
      visits: 0,
      labs: 0,
      vitals: 0,
      symptoms: 0,
      reports: 0,
      journal: 0,
      insightsNew: 0,
    }
  );
}
