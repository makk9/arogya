/**
 * Removes every ZZZ-prefixed throwaway + tracked session/report created by the
 * E3 verify-ui run. Deleting a report cascades its extraction_session
 * (reportId onDelete cascade). Committed ZZZ entities are swept by name/labName
 * prefix. Never touches non-ZZZ rows.
 *
 * Reads the seed ids blob as argv[2] (the E3_SEED_JSON payload). Run:
 *   tsx --conditions react-server --env-file=.env.local scripts/cleanup-e3-verify.ts '<json>'
 */
import { ilike, inArray } from "drizzle-orm";

import { db } from "../db";
import { labReports, medications, reports } from "../db/schema";

async function main(): Promise<void> {
  const raw = process.argv[2];
  const ids = raw ? (JSON.parse(raw) as Record<string, string>) : {};

  // Committed ZZZ entities (created by the commit engine during the run).
  const delMeds = await db
    .delete(medications)
    .where(ilike(medications.name, "ZZZ%"))
    .returning({ id: medications.id });
  const delLabs = await db
    .delete(labReports)
    .where(ilike(labReports.labName, "ZZZ%"))
    .returning({ id: labReports.id });

  // Tracked reports (cascades their sessions). Some may already be gone if a
  // ZZZ med/lab sweep didn't cover them — inArray tolerates missing ids.
  const reportIds = [ids.reportA, ids.reportB, ids.reportC].filter(Boolean);
  const delReports = reportIds.length
    ? await db.delete(reports).where(inArray(reports.id, reportIds)).returning({ id: reports.id })
    : [];

  console.log(
    `cleanup: meds=${delMeds.length} labs=${delLabs.length} reports=${delReports.length}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
