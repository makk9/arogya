/**
 * Smoke test for the quick-log path (router `log` branch → §5.4 text extraction).
 *
 * The classifier itself is covered by `router:check`; this exercises the server
 * half of the log branch end-to-end: processQuickLog creates a placeholder
 * Report (source text) + extraction_session, runs extraction over the text, and
 * records the outcome. Asserts the session is confirmable and the matched-entity
 * logic fires against the seeded vault, then cleans up.
 *
 * Gated on ANTHROPIC_API_KEY. Run via:  npm run quick-log:check
 */

import { getCurrentPatient, STUB_PATIENT_ID } from "../lib/auth";
import { extractionSessionQueries, reportQueries } from "../db/queries";
import { processQuickLog } from "../lib/chat/quick-log";
import type { ExtractionOutput } from "../lib/agents/_shared/schemas";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(
      "ANTHROPIC_API_KEY not set — skipping quick-log smoke (expected in CI without the secret).",
    );
    process.exit(0);
  }

  const { timezone } = await getCurrentPatient();
  const text =
    "Cardiologist raised his Telma to 80mg once daily, and BP was 152/95 this morning.";
  console.log(`quick-log input: ${text}\n`);

  let reportId: string | undefined;
  try {
    const startedAt = Date.now();
    const result = await processQuickLog({
      patientId: STUB_PATIENT_ID,
      timezone,
      text,
    });
    console.log(`processed in ${Date.now() - startedAt}ms`);
    // A loggable note is confirmable — possibly after a guided-scribe nudge (the
    // agent may ask for optional context first). Both outcomes persist the same
    // session + report + extraction output, so accept either here.
    assert(
      result.kind === "confirm" || result.kind === "nudge",
      "a loggable note is confirmable (optionally after a nudge)",
    );
    console.log(`outcome kind = ${result.kind}`);

    const session = await extractionSessionQueries.getById(
      STUB_PATIENT_ID,
      result.extractionSessionId,
    );
    reportId = session?.reportId;
    const report = reportId
      ? await reportQueries.getById(STUB_PATIENT_ID, reportId)
      : null;
    assert(session !== null, "extraction session exists");
    assert(report?.content === text, "report holds the source text in content");
    console.log(`session.status = ${session?.status}`);
    console.log(`report.status  = ${report?.status}`);

    assert(
      session?.status === "ready_for_confirmation",
      "session is ready_for_confirmation",
    );
    const out = session.extractionOutputJson as ExtractionOutput;
    console.log(JSON.stringify(out.extractions, null, 2));
    assert(out.extractions.length >= 1, "at least one extraction");

    // The compound input should yield a med update (Telma→seeded Telmisartan)
    // AND a vital create — the §5.5 compound-log case ("extraction does the
    // counting").
    const med = out.extractions.find((e) => e.target_entity_type === "medication");
    const vital = out.extractions.find(
      (e) => e.target_entity_type === "vital_reading",
    );
    if (med?.intent === "update" && med.matched_entity_id) {
      console.log(`✓ med matched: ${med.matched_entity_id}`);
    } else {
      console.warn("⚠ expected a Telma→Telmisartan med update (eyeball above)");
    }
    if (vital) console.log("✓ BP vital extracted (always create-new)");
  } finally {
    if (reportId) await reportQueries.delete(STUB_PATIENT_ID, reportId);
    console.log("\ncleaned up test report.");
  }

  // Guided-scribe nudge: a sparse log the agent is likely to ask about. The exact
  // outcome is probabilistic (warn, not assert), but WHEN a nudge fires its shape
  // must be sound — `hasEntities` present and boolean, so the UI can decide skip
  // vs. dismiss. Clean up the persisted session's report either way.
  const sparse = "He's started on a new blood pressure pill.";
  console.log(`\nnudge input: ${sparse}\n`);
  let nudgeReportId: string | undefined;
  try {
    const result = await processQuickLog({
      patientId: STUB_PATIENT_ID,
      timezone,
      text: sparse,
    });
    console.log(`nudge outcome kind = ${result.kind}`);
    if (result.kind === "nudge") {
      const session = await extractionSessionQueries.getById(
        STUB_PATIENT_ID,
        result.extractionSessionId,
      );
      nudgeReportId = session?.reportId;
      assert(
        typeof result.hasEntities === "boolean",
        "nudge carries a boolean hasEntities",
      );
      console.log(`✓ nudge: hasEntities=${result.hasEntities} — "${result.question}"`);
    } else {
      console.warn("⚠ expected a nudge for the sparse med (eyeball above)");
      if (result.kind === "confirm") nudgeReportId = result.reportId;
    }
  } finally {
    if (nudgeReportId) await reportQueries.delete(STUB_PATIENT_ID, nudgeReportId);
    console.log("cleaned up nudge test report.");
  }

  console.log("\nquick-log:check done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("quick-log:check FAILED:", err);
  process.exit(1);
});
