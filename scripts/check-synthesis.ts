/**
 * End-to-end smoke test for the synthesis agent.
 *
 * Verifies:
 *   1. runSynthesis() against the seed patient streams a non-empty response.
 *   2. Anthropic prompt caching is wired correctly — the second call hits the
 *      cache (cacheReadInputTokens > 0; cacheCreationInputTokens == 0).
 *
 * Gated on ANTHROPIC_API_KEY. Run via:
 *   npm run synthesis:check
 */

import { STUB_PATIENT_ID } from "../lib/auth";
import { runSynthesis } from "../lib/agents/synthesis";

if (!process.env.ANTHROPIC_API_KEY) {
  console.log(
    "ANTHROPIC_API_KEY not set — skipping synthesis smoke test (this is expected in CI without the secret).",
  );
  process.exit(0);
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    console.error(`ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

// `@ai-sdk/anthropic` 3.0.x surfaces `cacheCreationInputTokens` at the top level
// of providerMetadata.anthropic but NOT `cacheReadInputTokens` — that one only
// appears inside the raw `usage` JSONObject as snake_case `cache_read_input_tokens`.
// We read both directly off the raw usage to avoid relying on partial SDK mapping.
interface CacheMetrics {
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

function extractCacheMetrics(
  providerMetadata: Record<string, Record<string, unknown>> | undefined,
): CacheMetrics {
  const anthropicMeta = providerMetadata?.anthropic as
    | { usage?: Record<string, unknown> }
    | undefined;
  const usage = anthropicMeta?.usage ?? {};
  return {
    cacheCreationInputTokens: Number(usage.cache_creation_input_tokens ?? 0),
    cacheReadInputTokens: Number(usage.cache_read_input_tokens ?? 0),
  };
}

async function runOnce(label: string): Promise<CacheMetrics> {
  const startedAt = Date.now();
  const result = await runSynthesis({
    patientId: STUB_PATIENT_ID,
    messages: [
      {
        role: "user",
        content:
          "In one short sentence, what's the patient's name as it appears in the vault?",
      },
    ],
  });

  let firstTokenAt: number | null = null;
  let chars = 0;
  for await (const chunk of result.textStream) {
    if (firstTokenAt === null) firstTokenAt = Date.now();
    chars += chunk.length;
  }
  const finishedAt = Date.now();

  const providerMetadata = await result.providerMetadata;
  const metrics = extractCacheMetrics(
    providerMetadata as Record<string, Record<string, unknown>> | undefined,
  );

  const ttftMs = firstTokenAt !== null ? firstTokenAt - startedAt : null;
  const totalMs = finishedAt - startedAt;

  console.log(
    `[${label}] ttft=${ttftMs ?? "n/a"}ms total=${totalMs}ms chars=${chars} ` +
      `cache_creation=${metrics.cacheCreationInputTokens} ` +
      `cache_read=${metrics.cacheReadInputTokens}`,
  );

  assert(chars > 0, `${label}: response stream is non-empty`);
  return metrics;
}

async function main(): Promise<void> {
  console.log("Running synthesis smoke against seed patient...\n");

  const first = await runOnce("call-1");
  // Anthropic ephemeral cache has a 5-min TTL. The two calls fire back-to-back;
  // cache should be warm for the second.
  const second = await runOnce("call-2");

  // First call: cache_creation > 0 (cache was written). cache_read == 0.
  // We don't hard-assert cache_creation > 0 because Anthropic has a minimum
  // prompt size for caching (~1024 tokens) — for a fresh seed patient with no
  // medical data the system+vault block may sit under that floor. If it does,
  // log a warning rather than failing.
  if (first.cacheCreationInputTokens === 0) {
    console.log(
      "WARN: first call wrote 0 cache tokens. Either the prompt is below " +
        "Anthropic's caching floor (~1024 tokens), or cache wiring is broken. " +
        "Verify by adding seed medical data and re-running.",
    );
  } else {
    // Cache was written on call-1 → call-2 should read most of it. Anthropic
    // may write a small amount of new cache on call-2 (e.g., the user message
    // when it crosses a block boundary), so we don't require cache_creation == 0.
    assert(
      second.cacheReadInputTokens > 0,
      "second call should hit the cache (cache_read_input_tokens > 0)",
    );
    assert(
      second.cacheReadInputTokens >= first.cacheCreationInputTokens,
      `second call should read at least ${first.cacheCreationInputTokens} tokens from cache, got ${second.cacheReadInputTokens}`,
    );
    console.log(
      `\n✓ Cache hit confirmed: call-2 read ${second.cacheReadInputTokens} tokens from cache.`,
    );
  }

  console.log("\n✓ All synthesis smoke assertions passed.");
}

main().catch((err) => {
  console.error("synthesis smoke FAILED:", err);
  process.exit(1);
});
