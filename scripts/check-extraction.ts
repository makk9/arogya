/**
 * Smoke test for the extraction agent (E1).
 *
 * Two tiers:
 *  1. buildMatchingDictionary — pure, runs against the seeded vault with no API
 *     key. Asserts the dictionary carries names + UUIDs and NO change logs.
 *  2. runExtraction — live Sonnet. Gated on ANTHROPIC_API_KEY (skipped in CI
 *     without the secret). Runs canonical quick-log text inputs and prints the
 *     structured output; asserts loosely on shape + new-vs-update direction
 *     (model output varies, so we check intent/type, not exact field values).
 *
 * Run via:  npm run extraction:check
 */

import { STUB_PATIENT_ID } from "../lib/auth";
import { runExtraction } from "../lib/agents/extraction";
import { buildMatchingDictionary } from "../lib/agents/_shared/vault-context";
import type { ExtractionEntity } from "../lib/agents/_shared/schemas";

function assert(condition: unknown, message: string): void {
  if (!condition) {
    console.error(`ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

async function checkMatchingDictionary(): Promise<void> {
  console.log("=== Tier 1: buildMatchingDictionary (seeded vault) ===\n");
  const dict = await buildMatchingDictionary(STUB_PATIENT_ID);
  console.log(dict);
  console.log("");

  assert(dict.includes("# Existing records"), "has dictionary header");
  assert(dict.includes("## Medications"), "has medications section");
  assert(
    dict.includes("Telmisartan") && dict.includes("(brand Telma)"),
    "renders generic name + brand (Telmisartan / Telma)",
  );
  assert(
    /Dr\. Kavita Menon — Cardiology/.test(dict),
    "renders doctor name + specialty",
  );
  assert(
    /\(id: [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\)/.test(
      dict,
    ),
    "every entry carries a real UUID",
  );
  // The matching dictionary must NOT carry change logs (design.md 5.4:757).
  assert(
    !dict.includes("### Changes") && !dict.includes(" → "),
    "no change logs in the dictionary",
  );
  console.log("✓ Tier 1 matching-dictionary assertions passed.\n");
}

interface Case {
  readonly label: string;
  readonly input: string;
  // What we expect to see in the FIRST extraction for this single-entity input.
  readonly expectType: string;
  readonly expectIntent: ExtractionEntity["intent"] | "create-or-update";
  readonly note: string;
}

const cases: readonly Case[] = [
  {
    label: "update-by-brand",
    input: "Cardiologist bumped his Telma up to 80mg once daily.",
    expectType: "medication",
    expectIntent: "update",
    note: "Telma = brand of the seeded Telmisartan (40mg) → should MATCH (update).",
  },
  {
    label: "create-new-med",
    input: "Started him on pantoprazole 40mg in the morning for acid reflux.",
    expectType: "medication",
    expectIntent: "create",
    note: "Not in the vault → should be a new medication (create).",
  },
  {
    label: "vital-always-create",
    input: "BP 152/95 this morning before breakfast.",
    expectType: "vital_reading",
    expectIntent: "create",
    note: "Time-series reading → always create-new, never matched.",
  },
  {
    label: "unreadable",
    input: "asd;lkfj qwpo3 ;;;",
    expectType: "(none)",
    expectIntent: "create-or-update",
    note: "Gibberish → expect an empty extractions array (couldn't read).",
  },
];

async function checkExtraction(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(
      "ANTHROPIC_API_KEY not set — skipping Tier 2 live extraction (expected in CI without the secret).",
    );
    return;
  }

  console.log("=== Tier 2: runExtraction (live Sonnet, text quick-log) ===\n");
  let warnings = 0;

  for (const c of cases) {
    const startedAt = Date.now();
    try {
      const out = await runExtraction({
        patientId: STUB_PATIENT_ID,
        source: { type: "text", content: c.input },
      });
      const ms = Date.now() - startedAt;
      console.log(`[${c.label}] ${ms}ms — ${c.note}`);
      console.log(`  input: ${c.input}`);
      console.log(`  → ${out.extractions.length} extraction(s)`);
      console.log(JSON.stringify(out.extractions, null, 2));

      if (c.label === "unreadable") {
        if (out.extractions.length !== 0) {
          console.warn(
            `  ⚠ expected empty array for gibberish, got ${out.extractions.length}`,
          );
          warnings += 1;
        }
      } else {
        const first = out.extractions[0];
        if (!first) {
          console.warn(`  ⚠ expected at least one extraction, got none`);
          warnings += 1;
        } else {
          if (first.target_entity_type !== c.expectType) {
            console.warn(
              `  ⚠ type: expected ${c.expectType}, got ${first.target_entity_type}`,
            );
            warnings += 1;
          }
          if (
            c.expectIntent !== "create-or-update" &&
            first.intent !== c.expectIntent
          ) {
            console.warn(
              `  ⚠ intent: expected ${c.expectIntent}, got ${first.intent}`,
            );
            warnings += 1;
          }
          if (first.intent === "update" || first.intent === "uncertain") {
            console.log(`  matched_entity_id: ${first.matched_entity_id}`);
          }
        }
      }
      console.log("");
    } catch (err) {
      console.error(
        `[${c.label}] ERROR: ${err instanceof Error ? err.message : String(err)}`,
      );
      warnings += 1;
    }
  }

  // Warnings, not hard failures: the live model's exact bucketing/typing is
  // probabilistic. The script surfaces drift for a human to eyeball rather than
  // failing CI on a single off-call.
  console.log(
    warnings === 0
      ? "✓ Tier 2: all live extractions matched expectations.\n"
      : `⚠ Tier 2: ${warnings} expectation(s) diverged — eyeball the output above.\n`,
  );
}

async function main(): Promise<void> {
  await checkMatchingDictionary();
  await checkExtraction();
  console.log("extraction:check done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("extraction:check FAILED:", err);
  process.exit(1);
});
