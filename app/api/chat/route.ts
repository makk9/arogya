import { after } from "next/server";
import { convertToModelMessages, type ModelMessage, type UIMessage } from "ai";

import { chatQueries } from "@/db/queries/chat";
import { runAutoTitling } from "@/lib/agents/auto-titling";
import { runSynthesis } from "@/lib/agents/synthesis";
import { AgentError } from "@/lib/agents/_shared/errors";
import { apiError } from "@/lib/api/error";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { chatRequestSchema } from "@/lib/schemas/api/chat";

// postgres-js (transitively imported via buildVaultContext → @/db) requires Node.
export const runtime = "nodejs";

// Pulls the plain text out of a UIMessage's parts (the only part kind synthesis
// produces/consumes in v1). Loosely-typed because the boundary schema keeps
// `parts` opaque — we narrow defensively here.
function textFromParts(parts: unknown[]): string {
  return parts
    .filter(
      (p): p is { type: "text"; text: string } =>
        typeof p === "object" &&
        p !== null &&
        (p as { type?: unknown }).type === "text" &&
        typeof (p as { text?: unknown }).text === "string",
    )
    .map((p) => p.text)
    .join("");
}

export async function POST(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError("validation_failed", "Request body is not valid JSON");
  }

  const parsed = chatRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  // patientId is auth-derived, not client-supplied, per design.md 9.6:2755 +
  // CLAUDE.md tripwire ("All auth flows through getCurrentUser/Patient").
  const { patientId } = await getCurrentPatient();

  // The client (useChat) sends UIMessages with `parts`; runSynthesis/streamText
  // want ModelMessages. convertToModelMessages does the strict shape validation
  // the boundary schema intentionally skips — a malformed parts array throws
  // here and surfaces as a 400 rather than a 500.
  let modelMessages: ModelMessage[];
  try {
    modelMessages = await convertToModelMessages(parsed.data.messages as UIMessage[]);
  } catch {
    return apiError("validation_failed", "Invalid chat messages");
  }

  // Persistence path (E0b): when a sessionId is supplied (full-screen chat), the
  // turn is saved against that session. The ephemeral Ask-AI drawer omits it and
  // stays in-memory. Resolve + scope-check the session up front so a foreign or
  // stale id is a clean 404, never a write into someone else's conversation.
  const { sessionId } = parsed.data;

  // Filled by onFinish as the stream completes, then flushed (with the user turn
  // + auto-title) in an after() callback once the response has been sent.
  let assistantText = "";
  let turnCtx: { userText: string; isFirstExchange: boolean } | null = null;

  if (sessionId) {
    const session = await chatQueries.getSession(patientId, sessionId);
    if (!session) {
      return apiError("not_found", "Chat session not found");
    }

    const incoming = parsed.data.messages;
    const last = incoming[incoming.length - 1];
    const userText = last.role === "user" ? textFromParts(last.parts) : "";

    // A fresh session sends exactly one message (the page seeds prior turns from
    // the DB, so length 1 means nothing precedes this). That, plus a still-null
    // title, marks the first exchange — the trigger for auto-titling (E6).
    turnCtx = {
      userText,
      isFirstExchange: incoming.length === 1 && session.title === null,
    };
  }

  const onFinish =
    sessionId !== undefined
      ? (text: string) => {
          assistantText = text;
        }
      : undefined;

  try {
    const result = await runSynthesis({
      patientId,
      messages: modelMessages,
      surfaceContext: parsed.data.surfaceContext,
      onFinish,
    });

    if (sessionId && turnCtx) {
      const ctx = turnCtx;
      // Persist the turn + auto-title AFTER the response flushes. after() keeps
      // the function alive for this work without holding the stream open, so
      // neither the DB writes nor the ~1s Haiku title call prolong the client's
      // "streaming" state or risk hanging the connection (Next 16).
      after(async () => {
        // A failed or empty generation persists nothing — no orphan user row,
        // and a retry can't double-write the question.
        if (assistantText.length === 0) return;
        try {
          // Two separate inserts (distinct transactions) so the user row's
          // createdAt precedes the assistant's; getMessages also tie-breaks on
          // role, so order holds even if the timestamps collide.
          if (ctx.userText.length > 0) {
            await chatQueries.addMessage(sessionId, "user", ctx.userText);
          }
          await chatQueries.addMessage(sessionId, "assistant", assistantText);
        } catch (err) {
          logger.error({
            op: "chat.persist_turn",
            code: errorCode(err),
            ids: { patientId, sessionId },
          });
          return;
        }

        if (ctx.isFirstExchange && ctx.userText.length > 0) {
          try {
            const title = await runAutoTitling({
              firstUserMessage: ctx.userText,
              firstAiReply: assistantText,
            });
            // setTitleIfNull guards against clobbering a user rename that may
            // have landed while this call was in flight.
            await chatQueries.setTitleIfNull(sessionId, title);
          } catch (err) {
            // Titling is non-essential: on failure the session keeps its
            // fallback title (first user message). Swallow it.
            logger.warn({
              op: "chat.auto_title",
              code: errorCode(err),
              ids: { patientId, sessionId },
            });
          }
        }
      });
    }

    return result.toUIMessageStreamResponse();
  } catch (err) {
    if (err instanceof AgentError) {
      const status = err.code === "rate_limit" ? 429 : 500;
      return apiError(
        "server_error",
        err.message,
        { agentCode: err.code, agentName: err.agentName },
        status,
      );
    }
    return apiError("server_error", "Unexpected error");
  }
}
