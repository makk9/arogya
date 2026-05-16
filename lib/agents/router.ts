import Anthropic, {
  APIConnectionTimeoutError,
  APIError,
  RateLimitError,
} from "@anthropic-ai/sdk";

import { AgentError } from "@/lib/agents/_shared/errors";
import {
  routerOutputSchema,
  type RouterOutput,
} from "@/lib/agents/_shared/schemas";

export const ROUTER_MODEL_ID = "claude-haiku-4-5-20251001" as const;
export const ROUTER_MAX_OUTPUT_TOKENS = 256;

// Drafted from design.md 5.5:822-860 + 10.3:3211-3221. Brand voice from 7.1
// applied lightly — router produces no user-facing output, so persona is
// irrelevant; tone is technical-but-clear. 5.5:849-852 guardrails (bias toward
// question, explicit logging language wins, never silently route ambiguous, no
// medical interpretation) baked in. Per 10.3:3221, no medical hard rules apply
// here — this is routing, not medical reasoning.
export const ROUTER_SYSTEM_PROMPT = `You are the input router for arogya, a personal health knowledge base for adult children caring remotely for aging parents. Your only job is to classify a single chat input by intent so the system can route it to the right downstream agent. You produce no user-facing output.

# What you classify

Every chat input is one of three intents:

- "question" — the user is asking for synthesis, interpretation, or a doctor brief. Examples: "why is BP creeping up?", "should I worry about the dizziness?", "prep me for the cardiologist visit", "run a full health scan".
- "log" — the user is recording new data about the patient. Examples: "BP 152/95 this morning", "took amlodipine at 8am", "felt dizzy on the walk", "Log: started metformin 500mg".
- "ambiguous" — the input could plausibly be either, and the cost of guessing wrong is higher than asking the user one click. Surface this so the UI can disambiguate.

# Decision rules

- Inputs that look like factual data points (numbers with medical units, medication names with doses, dates, observed symptoms with a clear timestamp) → "log".
- Inputs phrased as questions or asking for interpretation → "question".
- Compound inputs that contain both a clear data point AND a question ("BP was 152/95 — is that concerning?") → "log". The system handles the question automatically after the log is confirmed.
- Explicit logging language always wins: "Log:", "Add:", "Record:", "Note:" prefix → "log" with high confidence.
- Long pasted text (multi-paragraph notes, pasted reports) → almost always "log".
- Empty or conversational inputs ("Hi", "thanks", "ok") → "question" with low confidence. Synthesis handles them gracefully.
- Genuinely unparseable inputs ("asdfasdf") → "ambiguous" with low confidence.

# Confidence

Three buckets:
- "high" — the input fits one rule cleanly. Used to route without prompting.
- "medium" — the input fits a rule but with some signal pulling the other way. The UI may show the disambiguator anyway, depending on the surface.
- "low" — weak signal in either direction. The UI will likely disambiguate.

# Bias

When uncertain between "question" and "log", prefer "question". A wrong route to extraction is trust-breaking (a confirmation screen appears for input the user intended as a question); a wrong route to chat is mildly annoying.

# Hard rules

- No medical interpretation. You classify input type, you do not reason about medical content.
- Never invent intent the input doesn't support.
- Output JSON only, matching this schema exactly. No prose, no markdown fences, no preamble.

# Output

Return a single JSON object:

{
  "intent": "question" | "log" | "ambiguous",
  "confidence": "high" | "medium" | "low",
  "reasoning": "one short sentence, for debugging — not shown to the user"
}`;

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  return match ? match[1].trim() : trimmed;
}

export interface RunRouterParams {
  input: string;
}

export async function runRouter(
  params: RunRouterParams,
): Promise<RouterOutput> {
  // Empty-input short-circuit: the prompt codifies "empty → question/low",
  // and there's no point paying for a round-trip on whitespace.
  const trimmed = params.input.trim();
  if (trimmed.length === 0) {
    return { intent: "question", confidence: "low", reasoning: "empty input" };
  }

  const client = new Anthropic();

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: ROUTER_MODEL_ID,
      max_tokens: ROUTER_MAX_OUTPUT_TOKENS,
      system: ROUTER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: trimmed }],
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      throw new AgentError("rate_limit", "router", true, err.message);
    }
    if (err instanceof APIConnectionTimeoutError) {
      throw new AgentError("timeout", "router", true, err.message);
    }
    if (err instanceof APIError) {
      throw new AgentError("unknown", "router", false, err.message);
    }
    throw new AgentError(
      "unknown",
      "router",
      false,
      err instanceof Error ? err.message : String(err),
    );
  }

  // Defend against tool_use / thinking blocks even though they can't appear here.
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  // Haiku frequently wraps JSON in markdown fences (```json ... ```) despite
  // explicit prompt instructions not to. Strip them defensively before parsing.
  const stripped = stripJsonFences(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new AgentError(
      "parse_failure",
      "router",
      false,
      `Router returned non-JSON output: ${text.slice(0, 200)}`,
    );
  }

  const result = routerOutputSchema.safeParse(parsed);
  if (!result.success) {
    throw new AgentError(
      "parse_failure",
      "router",
      false,
      `Router output failed schema validation: ${result.error.message}`,
    );
  }
  return result.data;
}
