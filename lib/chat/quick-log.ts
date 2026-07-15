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
}

export type ProcessQuickLogResult =
  // Entities to confirm (or a hard "couldn't read it" failure) → the §6.11 screen.
  | { kind: "confirm"; reportId: string; extractionSessionId: string }
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
export async function processQuickLog(
  params: ProcessQuickLogParams,
): Promise<ProcessQuickLogResult> {
  const { patientId, timezone, text } = params;

  // Extract first — before creating any row — so a decline leaves nothing behind.
  let output: unknown = null;
  let failed = false;
  try {
    const result = await runExtraction({
      patientId,
      source: { type: "text", content: text },
      today: todayInTimezone(timezone),
    });
    output = result;
    // Decline: the agent refused (e.g. a deletion) and produced no entity to
    // confirm. Surface the advisory in the chat directly — creating a stub Report
    // here would linger as an entity-less note on the timeline.
    if (result.extractions.length === 0 && result.notice) {
      return { kind: "declined", notice: result.notice };
    }
    // Empty with no notice = genuinely unreadable → the §6.11 failure state.
    failed = result.extractions.length === 0;
  } catch (err) {
    failed = true;
    logger.warn({
      op: "chat.quick_log.extraction",
      code: err instanceof AgentError ? `AgentError:${err.code}` : errorCode(err),
      ids: { patientId },
    });
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

  return { kind: "confirm", reportId: report.id, extractionSessionId: session.id };
}
