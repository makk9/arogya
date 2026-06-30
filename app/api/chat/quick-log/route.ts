import { apiError } from "@/lib/api/error";
import { parseJsonBody } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { processQuickLog } from "@/lib/chat/quick-log";
import { errorCode, logger } from "@/lib/logger";
import { quickLogRequestSchema } from "@/lib/schemas/api/chat";

// db queries + extraction SDK require Node.
export const runtime = "nodejs";

// Synchronous in-request extraction (no job queue, §9.3). A Sonnet text pass is
// quick, but give headroom over the platform default.
export const maxDuration = 60;

/**
 * POST /api/chat/quick-log — the router's `log` branch. Runs extraction over the
 * typed text and returns the confirmation-session id the client navigates to.
 * Extraction failures aren't errors here (the confirmation page renders the
 * §6.11 failure state); only DB failures surface as 500.
 */
export async function POST(req: Request): Promise<Response> {
  const { patientId, timezone } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = quickLogRequestSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const result = await processQuickLog({
      patientId,
      timezone,
      text: parsed.data.text,
    });
    return Response.json(
      {
        reportId: result.reportId,
        extractionSessionId: result.extractionSessionId,
      },
      { status: 201 },
    );
  } catch (err) {
    logger.error({ op: "chat.quick_log", code: errorCode(err), ids: { patientId } });
    return apiError("server_error", "Failed to process quick-log");
  }
}
