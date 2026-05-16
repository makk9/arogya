/**
 * End-to-end smoke test for the router agent.
 *
 * Runs a fixed set of canonical inputs against live Haiku and asserts each
 * routes to the expected intent. Latency is printed per case for a baseline.
 *
 * Gated on ANTHROPIC_API_KEY. Run via:
 *   npm run router:check
 */

import { runRouter } from "../lib/agents/router";
import type { RouterOutput } from "../lib/agents/_shared/schemas";

if (!process.env.ANTHROPIC_API_KEY) {
  console.log(
    "ANTHROPIC_API_KEY not set — skipping router smoke test (this is expected in CI without the secret).",
  );
  process.exit(0);
}

interface Case {
  readonly label: string;
  readonly input: string;
  readonly expected: RouterOutput["intent"];
}

const cases: readonly Case[] = [
  {
    label: "clear-question",
    input: "Why has BP been creeping up?",
    expected: "question",
  },
  {
    label: "clear-log",
    input: "BP 152/95 this morning",
    expected: "log",
  },
  {
    label: "explicit-log",
    input: "Log: started metformin 500mg",
    expected: "log",
  },
  {
    label: "compound",
    input: "BP was 152/95 — is that concerning?",
    expected: "log",
  },
  {
    label: "empty",
    input: "",
    expected: "question",
  },
  {
    label: "garbage",
    input: "asdfasdf",
    expected: "ambiguous",
  },
];

async function main(): Promise<void> {
  console.log("Running router smoke against live Haiku...\n");

  let failures = 0;
  for (const c of cases) {
    const startedAt = Date.now();
    try {
      const out = await runRouter({ input: c.input });
      const ms = Date.now() - startedAt;
      const ok = out.intent === c.expected;
      console.log(
        `[${c.label}] intent=${out.intent} confidence=${out.confidence} ${ms}ms ${ok ? "✓" : `✗ expected ${c.expected}`}`,
      );
      if (!ok) failures += 1;
    } catch (err) {
      console.error(
        `[${c.label}] ERROR: ${err instanceof Error ? err.message : String(err)}`,
      );
      failures += 1;
    }
  }

  if (failures > 0) {
    console.error(`\nrouter smoke FAILED: ${failures}/${cases.length} cases`);
    process.exit(1);
  }
  console.log(`\n✓ All ${cases.length} router smoke assertions passed.`);
}

main().catch((err) => {
  console.error("router smoke FAILED:", err);
  process.exit(1);
});
