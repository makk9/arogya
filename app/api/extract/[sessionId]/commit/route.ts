import type { ModelMessage } from "ai";

import { chatQueries, extractionSessionQueries } from "@/db/queries";
import { LOG_ACK_ADDENDUM, runSynthesis } from "@/lib/agents/synthesis";
import { apiError } from "@/lib/api/error";
import { parseJsonBody, validateUuidParam } from "@/lib/api/route-helpers";
import { getCurrentPatient, getCurrentUser } from "@/lib/auth";
import { todayInTimezone } from "@/lib/datetime";
import {
  commitCard,
  committedForAck,
  summarizeCommit,
  type CommitCardResult,
  type CommitContext,
} from "@/lib/extraction/commit";
import { scheduleInsightGeneration } from "@/lib/insights/schedule";
import { errorCode, logger } from "@/lib/logger";
import {
  commitRequestSchema,
  type CommitCardInput,
  type CommitEntityType,
} from "@/lib/schemas/api/extract-commit";

// Commit vocabulary (schema-table style) → canonical entity-ref types used by
// insights.triggered_by / entityRefsInScope.
const COMMIT_TYPE_TO_REF_TYPE: Record<CommitEntityType, string> = {
  medication: "med",
  condition: "condition",
  doctor: "doctor",
  allergy: "allergy",
  lab_report: "lab-report",
  vital_reading: "vital",
  visit: "visit",
  symptom_episode: "symptom-episode",
};

/**
 * The post-commit acknowledgement written back to the chat (§6.2:1197). A logged
 * entry deserves a conversational turn, not a mechanical receipt — synthesis
 * acknowledges it and engages only when there's real signal (LOG_ACK_ADDENDUM);
 * the just-committed entities are already in the vault it reads. Falls back to
 * the deterministic `summarizeCommit` string whenever synthesis is unavailable,
 * so the acknowledgement never fails to appear.
 */
async function buildLogAck(
  patientId: string,
  cards: CommitCardInput[],
  results: CommitCardResult[],
): Promise<string> {
  const committed = committedForAck(cards, results);
  if (committed.length === 0) return "";
  try {
    const messages: ModelMessage[] = [
      {
        role: "user",
        content: `[System note — not a question from the user. Just now, from this chat, the user logged the following to the record: ${committed}. Acknowledge it per the acknowledgement mode.]`,
      },
    ];
    const result = await runSynthesis({
      patientId,
      systemAddendum: LOG_ACK_ADDENDUM,
      messages,
    });
    const text = (await result.text).trim();
    if (text.length > 0) return text;
  } catch (err) {
    logger.warn({
      op: "extract.commit.log_ack",
      code: errorCode(err),
      ids: { patientId },
    });
  }
  return summarizeCommit(cards, results);
}

// db writes + extraction commit require Node.
export const runtime = "nodejs";

/**
 * POST /api/extract/[sessionId]/commit — the E3 human-in-the-loop write (§6.11).
 * The only path that turns extraction output into vault rows; extraction itself
 * never writes (§5.4:752 tripwire). The client sends the cards it's committing
 * with their user-resolved data; each is mapped + written with a source link to
 * the session's Report. `finalize` (set on the last card) flips the session +
 * report to `committed` once everything in this request succeeds.
 *
 * A per-card commit that's *blocked* (missing field, unmatchable ref) is not a
 * request error — it comes back as `{ ok: false, error }` in `results` for the
 * card to show; the request still succeeds for the cards that committed.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const param = await validateUuidParam(ctx.params, "sessionId", "session id");
  if (!param.ok) return param.response;

  const { patientId, timezone } = await getCurrentPatient();
  const { userId } = await getCurrentUser();

  const session = await extractionSessionQueries.getById(patientId, param.id);
  if (!session) return apiError("not_found", "Extraction session not found");
  if (session.status === "failed") {
    return apiError(
      "invalid_state_transition",
      "This extraction failed — there's nothing to commit. Try a different file or enter it manually.",
    );
  }
  if (session.status === "committed") {
    return apiError(
      "invalid_state_transition",
      "This extraction has already been committed.",
    );
  }

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;
  const parsed = commitRequestSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError("validation_failed", "Invalid commit request", parsed.error.flatten());
  }

  const commitCtx: CommitContext = {
    patientId,
    userId,
    timezone,
    reportId: session.reportId,
    today: todayInTimezone(timezone),
    nowIso: new Date().toISOString(),
  };

  let results: CommitCardResult[];
  try {
    // Sequential: a source rarely has many cards, and ordering keeps any shared
    // side effects (e.g. a symptom type born from the first episode, reused by
    // the second) deterministic.
    results = [];
    for (const card of parsed.data.cards) {
      results.push(await commitCard(commitCtx, card));
    }
  } catch (err) {
    logger.error({
      op: "extract.commit",
      code: errorCode(err),
      ids: { patientId, sessionId: param.id },
    });
    return apiError("server_error", "Something went wrong committing this extraction");
  }

  const allCommitted = results.every((r) => r.ok);
  let finalized = false;
  if (parsed.data.finalize && allCommitted) {
    try {
      await extractionSessionQueries.markCommitted({
        sessionId: session.id,
        reportId: session.reportId,
        patientId,
      });
      finalized = true;
    } catch (err) {
      logger.error({
        op: "extract.commit.finalize",
        code: errorCode(err),
        ids: { patientId, sessionId: param.id },
      });
      // Entities already wrote; report the partial state rather than 500.
    }
  }

  if (finalized) {
    // Fire-and-forget debounced insight generation (§5.6 / §9.3): a finalized
    // commit is exactly the "significant entity creation" trigger. One run per
    // finalize — the batch already settled into this single call — triggered
    // by the first committed clinical entity (a doctor row is care-team
    // bookkeeping, not clinical signal). Scheduled before (and independent of)
    // the chat acknowledgement, so an ack failure can't skip it.
    const triggerResult = results.find(
      (r) => r.ok && r.entityId && r.entityType !== "doctor",
    );
    if (triggerResult?.entityId) {
      scheduleInsightGeneration(patientId, {
        type: COMMIT_TYPE_TO_REF_TYPE[triggerResult.entityType],
        id: triggerResult.entityId,
      });
    } else if (parsed.data.cards.length === 0) {
      // Finalize-only request (the last card was discarded / handed to the
      // manual form after earlier per-card commits): the entities committed in
      // prior requests, so this request has no result to point at. Trigger on
      // the source Report they all backlink to.
      scheduleInsightGeneration(patientId, {
        type: "report",
        id: session.reportId,
      });
    }

    // Acknowledgement (§6.2:1197): write an assistant turn back to the
    // originating chat so returning to it shows a real thinking-partner
    // response engaging with what was logged, not just the user's own message
    // or a mechanical receipt. Scope-checked; a foreign/absent id or an empty
    // acknowledgement is silently skipped.
    if (parsed.data.chatSessionId) {
      try {
        const chat = await chatQueries.getSession(patientId, parsed.data.chatSessionId);
        if (chat) {
          const ack = await buildLogAck(patientId, parsed.data.cards, results);
          if (ack.length > 0) {
            await chatQueries.addMessage(chat.id, "assistant", ack);
          }
        }
      } catch (err) {
        logger.error({
          op: "extract.commit.ack",
          code: errorCode(err),
          ids: { patientId, sessionId: param.id },
        });
      }
    }
  }

  return Response.json({ results, finalized });
}
