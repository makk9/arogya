/**
 * Deletes orphan quick-log source-stub Reports — the placeholder Reports the
 * quick-log path creates to hold typed source text (§5.4). A stub = has an
 * extraction_session AND no source_file_url. These are hidden from the timeline
 * + vault context (reportQueries.forTimeline), but the truly-orphan ones — those
 * no entity references via source_report_id (never-confirmed `extracting` logs,
 * discontinue/update notes with no referrer) — are pure DB cruft.
 *
 * SAFE: only deletes stubs that NOTHING points to, so no real entity's source
 * link breaks. Deleting a Report cascades its extraction_session. Source-linked
 * stubs (a created entity's provenance) are kept. Idempotent.
 *
 *   tsx --conditions react-server --env-file=.env.local scripts/cleanup-orphan-source-stubs.ts
 */
import { eq, inArray, isNull } from "drizzle-orm";

import { db } from "../db";
import {
  conditions,
  extractionSessions,
  journalEntries,
  labReports,
  medications,
  reports,
  symptomEpisodes,
  visits,
  vitalReadings,
} from "../db/schema";

async function main(): Promise<void> {
  // Stubs: reports with an extraction_session AND no source file.
  const stubRows = await db
    .selectDistinct({ id: reports.id })
    .from(reports)
    .innerJoin(extractionSessions, eq(extractionSessions.reportId, reports.id))
    .where(isNull(reports.sourceFileUrl));
  const stubIds = stubRows.map((r) => r.id);
  if (stubIds.length === 0) {
    console.log("no source-stub reports found — nothing to do.");
    process.exit(0);
  }

  // Every source_report_id referenced across the 7 source-linked entity tables.
  const refRows = await Promise.all([
    db.selectDistinct({ id: medications.sourceReportId }).from(medications),
    db.selectDistinct({ id: conditions.sourceReportId }).from(conditions),
    db.selectDistinct({ id: labReports.sourceReportId }).from(labReports),
    db.selectDistinct({ id: vitalReadings.sourceReportId }).from(vitalReadings),
    db.selectDistinct({ id: visits.sourceReportId }).from(visits),
    db.selectDistinct({ id: symptomEpisodes.sourceReportId }).from(symptomEpisodes),
    db.selectDistinct({ id: journalEntries.sourceReportId }).from(journalEntries),
  ]);
  const referenced = new Set<string>();
  for (const set of refRows) {
    for (const row of set) if (row.id) referenced.add(row.id);
  }

  const orphans = stubIds.filter((id) => !referenced.has(id));
  const keptLinked = stubIds.length - orphans.length;

  if (orphans.length > 0) {
    await db.delete(reports).where(inArray(reports.id, orphans)); // cascades extraction_sessions
  }

  console.log(
    `source-stubs: ${stubIds.length} | deleted orphans: ${orphans.length} | kept (source-linked): ${keptLinked}`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
