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

export interface ProcessQuickLogResult {
  reportId: string;
  extractionSessionId: string;
}

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
 *
 * Never throws on extraction failure — returns the ids so the caller routes the
 * user to the confirmation page (which renders the §6.11 failure state).
 */
export async function processQuickLog(
  params: ProcessQuickLogParams,
): Promise<ProcessQuickLogResult> {
  const { patientId, timezone, text } = params;

  // Report first — holds the source text (no file). reportType unset (unknown
  // until the user confirms at E3); title is a placeholder.
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

  let output: unknown = null;
  let failed = false;
  try {
    const result = await runExtraction({
      patientId,
      source: { type: "text", content: text },
    });
    output = result;
    failed = result.extractions.length === 0;
  } catch (err) {
    failed = true;
    logger.warn({
      op: "chat.quick_log.extraction",
      code: err instanceof AgentError ? `AgentError:${err.code}` : errorCode(err),
      ids: { patientId, reportId: report.id, sessionId: session.id },
    });
  }

  await extractionSessionQueries.recordOutcome({
    sessionId: session.id,
    reportId: report.id,
    patientId,
    sessionStatus: failed ? "failed" : "ready_for_confirmation",
    reportStatus: failed ? "failed" : undefined,
    extractionOutputJson: output,
  });

  return { reportId: report.id, extractionSessionId: session.id };
}
