/**
 * End-to-end smoke test for the insight generator (E5, §5.6 / §9.3).
 *
 * Verifies:
 *   1. maybeRunInsightGeneration() against the seed patient completes a run —
 *      run row `succeeded`, generatedCount matches the inserted delta.
 *   2. Zero insights is a PASS (restraint is the spec; empty output is the
 *      default-correct result) — logged distinctly, not failed.
 *   3. Any inserted insight is well-formed: triggeredBy is the passed trigger
 *      (server-stamped), every cited/linked ref resolves in patient scope,
 *      modelVersion matches, body carries § citations, no externalRefs.
 *   4. An immediate second call is debounced ({ ran: false }).
 *
 * Cleans up after itself (deletes the insights + run rows it created) so
 * repeated runs stay idempotent. Gated on ANTHROPIC_API_KEY. Run via:
 *   npm run insight-generator:check
 */

import { eq, gte } from "drizzle-orm";

import { db } from "../db";
import { entityRefsInScope } from "../db/queries/entity-links";
import { medicationQueries } from "../db/queries/medication";
import { insightRuns, insights } from "../db/schema";
import { INSIGHT_MODEL_VERSION } from "../lib/agents/insight-generator";
import { STUB_PATIENT_ID } from "../lib/auth";
import { maybeRunInsightGeneration } from "../lib/insights/generate";

if (!process.env.ANTHROPIC_API_KEY) {
  console.log(
    "ANTHROPIC_API_KEY not set — skipping insight-generator smoke test (this is expected in CI without the secret).",
  );
  process.exit(0);
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    console.error(`ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  console.log("Running insight-generator smoke against seed patient...\n");
  const startedAt = new Date();

  // A real seeded medication as the trigger — the med vertical is the §1.3
  // north-star shape (dose change → dizziness correlation).
  const meds = await medicationQueries.forPatient(STUB_PATIENT_ID);
  assert(meds.length > 0, "seed patient has medications (run npm run db:seed)");
  const trigger = { type: "med", id: meds[0].id };
  console.log(`trigger: med ${meds[0].id}`);

  const t0 = Date.now();
  const first = await maybeRunInsightGeneration({
    patientId: STUB_PATIENT_ID,
    trigger,
  });
  console.log(
    `[call-1] ran=${first.ran} generated=${first.generatedCount} in ${Date.now() - t0}ms`,
  );
  assert(first.ran, "first call should run (not debounced)");

  // Run row: latest row for the patient, started during this script.
  const runRows = await db
    .select()
    .from(insightRuns)
    .where(gte(insightRuns.startedAt, startedAt));
  const runRow = runRows.find((r) => r.patientId === STUB_PATIENT_ID);
  assert(runRow, "run row was written");
  assert(
    runRow!.status === "succeeded",
    `run row status is succeeded (got ${runRow!.status}, errorCode=${runRow!.errorCode ?? "none"})`,
  );
  assert(
    runRow!.generatedCount === first.generatedCount,
    "run row generatedCount matches the returned count",
  );
  assert(
    runRow!.modelVersion === INSIGHT_MODEL_VERSION,
    "run row modelVersion matches",
  );

  // Inserted insights (if any) are well-formed.
  const newInsights = (
    await db
      .select()
      .from(insights)
      .where(gte(insights.generatedAt, startedAt))
  ).filter((i) => i.patientId === STUB_PATIENT_ID);
  assert(
    newInsights.length === first.generatedCount,
    `inserted insight delta (${newInsights.length}) matches generatedCount (${first.generatedCount})`,
  );

  if (newInsights.length === 0) {
    console.log(
      "\n✓ Zero insights generated — a PASS: empty output is the default-correct result (§5.6). " +
        "The run row records it; nothing hit the feed.",
    );
  } else {
    for (const insight of newInsights) {
      console.log(
        `\ninsight: [${insight.severity}/${insight.category}] ${insight.title}`,
      );
      assert(
        insight.triggeredBy.type === trigger.type &&
          insight.triggeredBy.id === trigger.id,
        "triggeredBy is the server-stamped trigger",
      );
      assert(
        insight.modelVersion === INSIGHT_MODEL_VERSION,
        "insight modelVersion matches",
      );
      assert(insight.externalRefs === null, "externalRefs is null (v1 rule)");
      assert(insight.body.includes("§"), "body carries inline § citations");
      assert(
        insight.citedSources.length > 0,
        "insight has at least one cited source",
      );
      const refs = [
        ...insight.citedSources,
        ...(insight.linkedEntities ?? []),
      ];
      const inScope = await entityRefsInScope(STUB_PATIENT_ID, refs);
      for (const ref of refs) {
        assert(
          inScope.has(`${ref.type}:${ref.id}`),
          `ref ${ref.type}:${ref.id} resolves in patient scope`,
        );
      }
    }
    console.log(`\n✓ ${newInsights.length} insight(s) generated, all well-formed.`);
  }

  // Immediate re-call → debounced.
  const second = await maybeRunInsightGeneration({
    patientId: STUB_PATIENT_ID,
    trigger,
  });
  console.log(`[call-2] ran=${second.ran} (expect false — 30s debounce)`);
  assert(!second.ran, "second call within 30s is debounced");

  // Cleanup: remove what this script created so re-runs stay idempotent.
  for (const i of newInsights) {
    await db.delete(insights).where(eq(insights.id, i.id));
  }
  await db.delete(insightRuns).where(eq(insightRuns.id, runRow!.id));
  console.log("\ncleanup: removed the run row and generated insights.");

  console.log("\n✓ All insight-generator smoke assertions passed.");
  process.exit(0);
}

main().catch((err) => {
  console.error("insight-generator smoke FAILED:", err);
  process.exit(1);
});
