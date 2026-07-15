import { notFound } from "next/navigation";

import { ExtractionConfirmation } from "@/components/extract/extraction-confirmation";
import { extractionSessionQueries, reportQueries } from "@/db/queries";
import { parseStoredExtractionOutput } from "@/lib/agents/extraction";
import { getCurrentPatient } from "@/lib/auth";
import { mimeFromPath } from "@/lib/files/mime";
import { getSignedUrl } from "@/lib/storage";

// db queries + storage signing require Node.
export const runtime = "nodejs";

/**
 * §6.11 extraction confirmation surface (E3). Server component: loads the
 * session + its Report, re-validates the stored extraction output (untyped
 * jsonb → safe null on drift, never a cast), signs the source file for preview,
 * and hands off to the client surface that does the review + commit. Reached
 * from both the upload pipeline and the quick-log router (§6.11:1718).
 */
export default async function ExtractConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; sessionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id, sessionId } = await params;
  const { patientId } = await getCurrentPatient();
  if (id !== patientId) notFound();

  // Where to go after commit/discard. Set by the chat log path so the user
  // returns to the conversation they logged from (§6.2:1197). Accept only a
  // same-origin absolute path (leading single slash, no `//` or scheme) to
  // avoid an open-redirect; anything else falls back to the patient profile.
  const sp = await searchParams;
  const rawReturn = sp.returnTo;
  const candidate = Array.isArray(rawReturn) ? rawReturn[0] : rawReturn;
  const returnTo =
    candidate && /^\/[^/]/.test(candidate) ? candidate : undefined;

  // The originating chat session (for the "Logged ✓" acknowledgement). Validated
  // as a uuid; anything else is ignored.
  const rawChat = sp.chatSessionId;
  const chatCandidate = Array.isArray(rawChat) ? rawChat[0] : rawChat;
  const chatSessionId =
    chatCandidate && /^[0-9a-f-]{36}$/i.test(chatCandidate)
      ? chatCandidate
      : undefined;

  // Set by the chat log path when the chat session was created solely for this
  // log. On a full discard the surface removes that session so it doesn't linger
  // as a titled empty conversation with a dangling user turn.
  const rawNew = sp.newSession;
  const newCandidate = Array.isArray(rawNew) ? rawNew[0] : rawNew;
  const newChatSession = newCandidate === "1";

  const session = await extractionSessionQueries.getById(patientId, sessionId);
  if (!session) notFound();

  const report = await reportQueries.getById(patientId, session.reportId);
  const output = parseStoredExtractionOutput(session.extractionOutputJson);
  const extractions = output?.extractions ?? [];

  // Source: a quick-log Report carries typed text in `content`; an uploaded
  // Report carries a file path in `sourceFileUrl` (signed per-load, never
  // stored). Fall through to "none" if neither is present.
  let source:
    | { kind: "text"; content: string }
    | { kind: "file"; url: string; mimeType: string; filename: string }
    | { kind: "none" } = { kind: "none" };
  let sourceLabel = "this source";

  if (report?.content) {
    source = { kind: "text", content: report.content };
    sourceLabel = "text input";
  } else if (report?.sourceFileUrl) {
    const url = await getSignedUrl(report.sourceFileUrl);
    source = {
      kind: "file",
      url,
      mimeType: mimeFromPath(report.sourceFileUrl),
      filename: report.title,
    };
    sourceLabel = report.title;
  }

  return (
    <ExtractionConfirmation
      patientId={patientId}
      sessionId={sessionId}
      extractions={extractions}
      status={session.status}
      source={source}
      sourceLabel={sourceLabel}
      returnTo={returnTo}
      chatSessionId={chatSessionId}
      newChatSession={newChatSession}
    />
  );
}
