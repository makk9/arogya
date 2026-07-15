import "server-only";

import { extractionSessionQueries, reportQueries } from "@/db/queries";
import { runExtraction, type ExtractionSource } from "@/lib/agents/extraction";
import { AgentError } from "@/lib/agents/_shared/errors";
import { todayInTimezone } from "@/lib/datetime";
import { errorCode, logger } from "@/lib/logger";
import { downloadFile, uploadPathPrefix } from "@/lib/storage";

// App-level upload cap, enforced at /process after download (before spending
// extraction tokens on an oversized file). This is NOT the hard backstop — the
// Supabase bucket's own file-size limit caps what can be PUT in the first place;
// this just keeps a large-but-under-bucket-limit file from reaching the agent.
// Also surfaced as an advisory client-side check in the /sign request schema.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

// MIME types we accept for upload + extraction. Images go to the vision path; PDF
// goes to Anthropic's document block. HEIC is intentionally excluded — the API
// doesn't accept it as an image source (design.md 9.4:2614 names HEIC for
// display only). Kept here as the single source of truth for /api/files/sign.
export const ACCEPTED_UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
] as const;

export type AcceptedUploadMimeType = (typeof ACCEPTED_UPLOAD_MIME_TYPES)[number];

export function isAcceptedUploadMimeType(
  mimeType: string,
): mimeType is AcceptedUploadMimeType {
  return (ACCEPTED_UPLOAD_MIME_TYPES as readonly string[]).includes(mimeType);
}

// Strips the `patients/{id}/uploads/{timestamp}-` prefix back to a human title
// for the placeholder Report; refined by the user at the E3 confirmation commit.
function titleFromPath(path: string): string {
  const base = path.split("/").pop() ?? path;
  const withoutTimestamp = base.replace(/^\d+-/, "");
  return withoutTimestamp.length > 0 ? withoutTimestamp : base;
}

function sourceFor(
  mimeType: AcceptedUploadMimeType,
  base64: string,
): ExtractionSource {
  if (mimeType === "application/pdf") {
    return { type: "document", data: base64 };
  }
  return { type: "image", mediaType: mimeType, data: base64 };
}

export interface ProcessUploadParams {
  patientId: string;
  // Patient's IANA timezone, passed in by the caller (the route already resolved
  // the CurrentPatient) so this lib takes all identity by argument — no ambient
  // getCurrentPatient() call, one source of patient truth, trivially testable.
  timezone: string;
  // Storage path returned by /api/files/sign and PUT-to by the browser.
  path: string;
  mimeType: AcceptedUploadMimeType;
}

export type ProcessUploadResult =
  | { ok: true; reportId: string; extractionSessionId: string }
  | { ok: false; reason: "path_out_of_scope" | "unsupported_type" };

/**
 * The upload → extraction handoff (design.md 9.4:2582). Creates the Report
 * up-front (status `extracting`) so the file has a permanent home even if
 * extraction fails, plus a `pending` extraction session; downloads the file,
 * runs the extraction agent, and records the outcome on the session.
 *
 * Status mapping (consistent with buildVaultContext's `ready|committed` filter —
 * an uploaded report is NOT vault-visible until its entities are committed at
 * E3):
 *   - non-empty extractions → session `ready_for_confirmation`, report stays `extracting`
 *   - empty array (couldn't read) or a thrown AgentError → session `failed`, report `failed`
 *
 * Never throws on an extraction failure — returns the ids so the caller can send
 * the user to the confirmation page, which renders the §6.11 failure state.
 * Infrastructure errors (DB, storage) propagate to the caller's 500 handler.
 */
export async function processUpload(
  params: ProcessUploadParams,
): Promise<ProcessUploadResult> {
  const { patientId, timezone, path, mimeType } = params;

  // Trust boundary: the path is client-supplied. It MUST live under this
  // patient's upload namespace — never process another patient's (or an
  // arbitrary) object just because the client named it.
  if (!path.startsWith(uploadPathPrefix(patientId))) {
    return { ok: false, reason: "path_out_of_scope" };
  }
  if (!isAcceptedUploadMimeType(mimeType)) {
    return { ok: false, reason: "unsupported_type" };
  }

  // Report first — the file's permanent home (9.4:2601). reportType is left
  // unset (unknown until the user confirms at E3); title/date are placeholders.
  const report = await reportQueries.create({
    patientId,
    title: titleFromPath(path),
    reportDate: todayInTimezone(timezone),
    sourceFileUrl: path,
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
    const { bytes, contentType } = await downloadFile(path);
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      // Over the app cap — fail before spending extraction tokens.
      failed = true;
      logger.warn({
        op: "files.process.too_large",
        code: "file_too_large",
        ids: { patientId, reportId: report.id, sessionId: session.id },
      });
    } else {
      // Prefer the stored content type over the client's declaration when it's a
      // type we support — defends against a mislabelled upload (PNG-declared PDF)
      // being sent down the wrong (image vs. document) path.
      const effectiveMime =
        contentType && isAcceptedUploadMimeType(contentType)
          ? contentType
          : mimeType;
      const base64 = Buffer.from(bytes).toString("base64");
      const result = await runExtraction({
        patientId,
        source: sourceFor(effectiveMime, base64),
        today: todayInTimezone(timezone),
      });
      output = result;
      // An empty array is a valid "couldn't read it" outcome (5.4:814), surfaced
      // as the §6.11 failure state — not an error, but also not confirmable. (The
      // quick-log path also handles a `notice` decline here; an uploaded document
      // can't ask to delete a record, so there's no notice branch to mirror.)
      failed = result.extractions.length === 0;
    }
  } catch (err) {
    failed = true;
    logger.warn({
      op: "files.process.extraction",
      code: err instanceof AgentError ? `AgentError:${err.code}` : errorCode(err),
      ids: { patientId, reportId: report.id, sessionId: session.id },
    });
  }

  // One transactional write so session + report status can't diverge. On
  // success the report stays "extracting" (→ "committed" at the E3 commit), so
  // reportStatus is only set on failure.
  await extractionSessionQueries.recordOutcome({
    sessionId: session.id,
    reportId: report.id,
    patientId,
    sessionStatus: failed ? "failed" : "ready_for_confirmation",
    reportStatus: failed ? "failed" : undefined,
    extractionOutputJson: output,
  });

  return { ok: true, reportId: report.id, extractionSessionId: session.id };
}
