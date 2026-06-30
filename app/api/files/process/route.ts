import { apiError } from "@/lib/api/error";
import { parseJsonBody } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { processUpload } from "@/lib/files/pipeline";
import { errorCode, logger } from "@/lib/logger";
import { processUploadSchema } from "@/lib/schemas/api/files";

// postgres-js (via db queries) + supabase storage + extraction SDK all require Node.
export const runtime = "nodejs";

// Extraction runs synchronously inside the request (no job queue in v1, per the
// §9.3 tripwire). A Sonnet vision/PDF pass can take several seconds; give the
// function headroom over the platform default.
export const maxDuration = 60;

/**
 * POST /api/files/process — step 3 of the §9.4 pipeline. Creates the Report +
 * extraction session for an already-uploaded file and runs extraction over it,
 * returning the ids the client uses to navigate to the E3 confirmation page.
 * Extraction failures are NOT errors here — they resolve to a `failed` session
 * the confirmation page renders; the response still carries the ids.
 */
export async function POST(req: Request): Promise<Response> {
  const { patientId, timezone } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = processUploadSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const result = await processUpload({
      patientId,
      timezone,
      path: parsed.data.path,
      mimeType: parsed.data.mimeType,
    });

    if (!result.ok) {
      // path_out_of_scope: client named a path outside its upload namespace.
      // unsupported_type: shouldn't reach here (schema gates mimeType) — defense.
      return apiError(
        "validation_failed",
        result.reason === "path_out_of_scope"
          ? "File path is not in this patient's upload namespace"
          : "Unsupported file type",
      );
    }

    return Response.json(
      {
        reportId: result.reportId,
        extractionSessionId: result.extractionSessionId,
      },
      { status: 201 },
    );
  } catch (err) {
    logger.error({
      op: "files.process",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to process upload");
  }
}
