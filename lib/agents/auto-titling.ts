import Anthropic, {
  APIConnectionTimeoutError,
  APIError,
  RateLimitError,
} from "@anthropic-ai/sdk";

import { AgentError } from "@/lib/agents/_shared/errors";

/**
 * Auto-titling agent (design.md 6.2:1217 + 9.3) — Phase E item E6.
 *
 * A trivial Haiku call fired after the first AI reply in a chat session. Input
 * is the first user message + first AI reply; output is a 3-6 word natural-
 * shorthand title written to `chat_sessions.title`. Non-streaming, direct SDK
 * (9.3:2409 non-streaming pattern). No vault context — titling reasons only
 * over the two messages it's handed, never the record.
 *
 * The output is a bare title string, not a structured object: there's nothing
 * to validate beyond "non-empty short line," so this skips the Zod path the
 * JSON agents use and sanitizes instead (strip quotes/fences, clamp length).
 */

export const AUTO_TITLE_MODEL_ID = "claude-haiku-4-5-20251001" as const;
export const AUTO_TITLE_MAX_OUTPUT_TOKENS = 32;

// Voice per 7.1: the examples are plain natural shorthand, not headline case or
// sycophantic framing. The model produces no other user-facing text, so persona
// is irrelevant — the job is a faithful, scannable label.
export const AUTO_TITLE_SYSTEM_PROMPT = `You name a chat conversation in a personal health knowledge base. Given the first user message and the first AI reply, return a 3-6 word title that captures what the conversation is about, in natural shorthand a person would recognize at a glance.

Rules:
- 3 to 6 words. Never a full sentence.
- Plain and specific. Prefer the concrete subject over a generic label.
- No surrounding quotes, no trailing punctuation, no markdown.
- Match the language and register of the conversation; don't add enthusiasm.

Good examples:
- Why is creatinine at 1.4?
- Prep · Patel Friday
- Full health scan · April
- Amlodipine dose change
- Morning dizziness pattern

Return only the title text — nothing else.`;

// Caps a runaway title at a sane length without mid-word truncation noise. The
// prompt asks for 3-6 words; this is a backstop, not the primary limiter.
const MAX_TITLE_CHARS = 60;

function sanitizeTitle(raw: string): string {
  let title = raw.trim();
  // Strip a wrapping pair of quotes/backticks the model sometimes adds.
  title = title.replace(/^["'`]+|["'`]+$/g, "").trim();
  // Collapse internal whitespace/newlines to single spaces.
  title = title.replace(/\s+/g, " ");
  // Drop a trailing sentence period (but keep a `?` — it's natural shorthand).
  title = title.replace(/\.+$/, "").trim();
  if (title.length > MAX_TITLE_CHARS) {
    title = `${title.slice(0, MAX_TITLE_CHARS - 1).trimEnd()}…`;
  }
  return title;
}

export interface RunAutoTitlingParams {
  firstUserMessage: string;
  firstAiReply: string;
}

export async function runAutoTitling(
  params: RunAutoTitlingParams,
): Promise<string> {
  const client = new Anthropic();

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: AUTO_TITLE_MODEL_ID,
      max_tokens: AUTO_TITLE_MAX_OUTPUT_TOKENS,
      system: AUTO_TITLE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `First message:\n${params.firstUserMessage}\n\nFirst reply:\n${params.firstAiReply}`,
        },
      ],
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      throw new AgentError("rate_limit", "auto-titling", true, err.message);
    }
    if (err instanceof APIConnectionTimeoutError) {
      throw new AgentError("timeout", "auto-titling", true, err.message);
    }
    if (err instanceof APIError) {
      throw new AgentError("unknown", "auto-titling", false, err.message);
    }
    throw new AgentError(
      "unknown",
      "auto-titling",
      false,
      err instanceof Error ? err.message : String(err),
    );
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  const title = sanitizeTitle(text);
  if (title.length === 0) {
    throw new AgentError(
      "parse_failure",
      "auto-titling",
      false,
      "Auto-titling returned an empty title",
    );
  }
  return title;
}
