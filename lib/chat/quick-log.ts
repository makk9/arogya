import "server-only";

import { extractionSessionQueries, reportQueries } from "@/db/queries";
import { runExtraction } from "@/lib/agents/extraction";
import { AgentError } from "@/lib/agents/_shared/errors";
import { todayInTimezone } from "@/lib/datetime";
import { errorCode, logger } from "@/lib/logger";

// A short, human title for the placeholder Report holding the quick-log text
// (and, when the log came from a chat session, that session's fallback title);
// refined by the user at the E3 confirmation commit.
export function titleFromText(text: string): string {
  const oneLine = text.trim().replace(/\s+/g, " ");
  return oneLine.length > 60 ? `${oneLine.slice(0, 59)}…` : oneLine;
}

export interface ProcessQuickLogParams {
  patientId: string;
  // Patient's IANA timezone — passed in (caller resolved CurrentPatient) so this
  // lib takes all identity by argument, mirroring processUpload.
  timezone: string;
  text: string;
  // When set, `text` is the user's ANSWER to an enrichment nudge: re-extract the
  // original log (on this session's report) + the answer, overwriting in place.
  reuseSessionId?: string;
}

export type ProcessQuickLogResult =
  // Entities to confirm (or a hard "couldn't read it" failure) → the §6.11 screen.
  | { kind: "confirm"; reportId: string; extractionSessionId: string }
  // Sparse record + the agent asked for optional context — surfaced as a chat
  // nudge. The session is already persisted (skip = navigate; answer = re-extract).
  // `hasEntities` is false when the agent asked but extracted nothing yet (e.g.
  // "a blood pressure pill", no name): skipping then has nothing to confirm, so
  // the UI dismisses in-chat instead of opening the (empty → failure) screen.
  | { kind: "nudge"; question: string; extractionSessionId: string; hasEntities: boolean }
  // The agent refused (e.g. a deletion) and produced no entity — surfaced as a
  // chat reply, with no placeholder Report/session left behind.
  | { kind: "declined"; notice: string };

/**
 * Free-text quick-log → extraction handoff (§5.4 text-input mode) — the text
 * counterpart of processUpload. The typed note IS the source: it's stored on a
 * placeholder Report's `content` (the §6.11 "Source · text input" the
 * confirmation screen renders), which also gives the extraction_session its
 * required report_id and is the `source_report_id` target once entities commit.
 *
 * Same status mapping + never-auto-write discipline as the upload path:
 *   - non-empty extractions → session `ready_for_confirmation`, report `extracting`
 *   - empty array / thrown AgentError → session `failed`, report `failed`
 *   - declined (empty extractions + a notice, e.g. a refused deletion) → no
 *     Report/session created; the notice is returned for the chat to show inline
 *
 * Never throws on extraction failure — returns a `confirm` outcome so the caller
 * routes the user to the confirmation page (which renders the §6.11 failure
 * state), or a `declined` outcome carrying the advisory.
 */
function logExtractionFailure(patientId: string, err: unknown): void {
  logger.warn({
    op: "chat.quick_log.extraction",
    code: err instanceof AgentError ? `AgentError:${err.code}` : errorCode(err),
    ids: { patientId },
  });
}

export async function processQuickLog(
  params: ProcessQuickLogParams,
): Promise<ProcessQuickLogResult> {
  const { patientId, timezone, text, reuseSessionId } = params;

  // ── Answer to an enrichment nudge ──────────────────────────────────────────
  // `text` is the user's answer; re-extract the original log (held on this
  // session's report) PLUS the answer, and overwrite the session in place — no
  // second session, no orphan. The enrichment/notice fields are ignored on this
  // second pass (one round only). A stale or already-closed reuse id falls
  // through to a fresh log.
  if (reuseSessionId) {
    const found = await extractionSessionQueries.getById(patientId, reuseSessionId);
    // Only a still-open review may be re-extracted. A committed session (the
    // user took "just log it", confirmed, then answered the stale nudge) must
    // not flip back to ready_for_confirmation — confirming it again would
    // duplicate every entity. Anything else falls through to a fresh log.
    const session =
      found &&
      (found.status === "ready_for_confirmation" || found.status === "failed")
        ? found
        : null;
    const report = session
      ? await reportQueries.getById(patientId, session.reportId)
      : null;
    if (session && report) {
      const combined = [report.content, text].filter(Boolean).join("\n");
      let output: unknown = null;
      let failed = false;
      try {
        const result = await runExtraction({
          patientId,
          source: { type: "text", content: combined },
          today: todayInTimezone(timezone),
        });
        output = result;
        failed = result.extractions.length === 0;
      } catch (err) {
        failed = true;
        logExtractionFailure(patientId, err);
      }
      await reportQueries.update(patientId, session.reportId, { content: combined });
      await extractionSessionQueries.recordOutcome({
        sessionId: session.id,
        reportId: session.reportId,
        patientId,
        sessionStatus: failed ? "failed" : "ready_for_confirmation",
        reportStatus: failed ? "failed" : undefined,
        extractionOutputJson: output,
      });
      return { kind: "confirm", reportId: session.reportId, extractionSessionId: session.id };
    }
  }

  // ── First pass ─────────────────────────────────────────────────────────────
  // Extract before creating any row — so a decline leaves nothing behind.
  let output: unknown = null;
  let failed = false;
  let enrichmentQuestion: string | undefined;
  let entityCount = 0;
  try {
    const result = await runExtraction({
      patientId,
      source: { type: "text", content: text },
      today: todayInTimezone(timezone),
    });
    output = result;
    entityCount = result.extractions.length;
    // Decline: the agent refused (e.g. a deletion) and produced no entity to
    // confirm. Surface the advisory in the chat directly — creating a stub Report
    // here would linger as an entity-less note on the timeline.
    if (result.extractions.length === 0 && result.notice) {
      return { kind: "declined", notice: result.notice };
    }
    // The agent may ask for more even with nothing extracted yet (e.g. "a blood
    // pressure pill" — no name), so the nudge is independent of extraction count.
    enrichmentQuestion = result.enrichment?.question;
    // Empty AND no notice AND no question = genuinely unreadable → failure state.
    failed = result.extractions.length === 0 && !enrichmentQuestion;
  } catch (err) {
    failed = true;
    logExtractionFailure(patientId, err);
  }

  // We have entities to confirm (or a hard failure to show): the typed note
  // becomes the source Report (§6.11 "Source · text input") + the session that
  // gives it a report_id and the `source_report_id` target once entities commit.
  const report = await reportQueries.create({
    patientId,
    title: titleFromText(text),
    reportDate: todayInTimezone(timezone),
    content: text,
    status: "extracting",
  });
  const session = await extractionSessionQueries.create({
    patientId,
    reportId: report.id,
    status: "pending",
  });
  await extractionSessionQueries.recordOutcome({
    sessionId: session.id,
    reportId: report.id,
    patientId,
    sessionStatus: failed ? "failed" : "ready_for_confirmation",
    reportStatus: failed ? "failed" : undefined,
    extractionOutputJson: output,
  });

  // Nudge: the record is sparse and the agent asked for more. The session is
  // persisted (so "just log it" is a free navigation, and answering re-extracts
  // into it). Guided-scribe step 2 (decisions.md 2026-07-17).
  if (enrichmentQuestion) {
    return {
      kind: "nudge",
      question: enrichmentQuestion,
      extractionSessionId: session.id,
      hasEntities: entityCount > 0,
    };
  }
  return { kind: "confirm", reportId: report.id, extractionSessionId: session.id };
}
