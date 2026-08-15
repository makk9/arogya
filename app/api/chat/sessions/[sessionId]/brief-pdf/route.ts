import { chatQueries } from "@/db/queries/chat";
import { apiError } from "@/lib/api/error";
import { validateUuidParam } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { briefModeOf } from "@/lib/chat/brief";
import { dateInTimezone } from "@/lib/datetime";
import { errorCode, logger } from "@/lib/logger";
import { renderBriefPdf } from "@/lib/pdf/brief-document";
import { parseBrief } from "@/lib/pdf/brief-parse";
import { briefStatsFromText } from "@/lib/pdf/brief-stats";

// postgres-js (via chatQueries) and @react-pdf/renderer both require Node.
export const runtime = "nodejs";

type Ctx = { params: Promise<{ sessionId: string }> };

/**
 * GET /api/chat/sessions/:sessionId/brief-pdf?index=N — export a doctor brief
 * from a persisted chat session as a PDF (design.md 5.7, Phase E item E7).
 *
 * `index` is the target's position among the session's brief-marked assistant
 * messages (0-based; omitted → the most recent). The client addresses briefs
 * by position rather than message id because a freshly streamed message only
 * has an AI-SDK id client-side — the DB row id isn't known until reload — and
 * both sides see the same transcript order, so the index is unambiguous.
 *
 * The PDF is regenerated on every download from the persisted message — no
 * stored artifact, per 5.7's "the chat session preserves it".
 */
export async function GET(req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "sessionId", "session id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId, timezone } = await getCurrentPatient();

  const rawIndex = new URL(req.url).searchParams.get("index");
  if (rawIndex !== null && !/^\d+$/.test(rawIndex)) {
    return apiError("validation_failed", "Invalid request", {
      index: ["Must be a non-negative integer (0-based brief position)."],
    });
  }

  try {
    const session = await chatQueries.getSession(patientId, idCheck.id);
    if (!session) {
      return apiError("not_found", "Chat session not found");
    }

    const messages = await chatQueries.getMessages(patientId, session.id);
    const briefs = messages.filter(
      (m) => m.role === "assistant" && briefModeOf(m.content) !== null,
    );
    const target =
      rawIndex === null ? briefs[briefs.length - 1] : briefs[Number(rawIndex)];
    if (!target) {
      return apiError("not_found", "No brief at that position in this session");
    }

    // Non-null by the filter above; parseBrief re-checks the marker.
    const doc = parseBrief(target.content);
    if (!doc) {
      return apiError("server_error", "Failed to parse brief content");
    }

    const pdf = await renderBriefPdf(doc, briefStatsFromText(target.content));
    // Filename date in the patient's calendar (§4:243), not UTC — an evening
    // generation in IST would otherwise be stamped with the wrong day.
    const date = dateInTimezone(target.createdAt, timezone);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="arogya-brief-${doc.mode}-${date}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    logger.error({
      op: "chat.brief_pdf",
      code: errorCode(err),
      ids: { patientId, sessionId: idCheck.id },
    });
    return apiError("server_error", "Failed to generate the brief PDF");
  }
}
