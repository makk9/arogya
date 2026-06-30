import { apiError } from "@/lib/api/error";
import { parseJsonBody } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { signUploadSchema } from "@/lib/schemas/api/files";
import { buildUploadPath, createSignedUploadUrl } from "@/lib/storage";

// @supabase/supabase-js storage admin client + lib/storage's "server-only" guard
// require the Node runtime.
export const runtime = "nodejs";

/**
 * POST /api/files/sign — step 1 of the §9.4 upload pipeline. Returns a signed
 * URL the browser PUTs the file to directly (no round-trip through us), plus the
 * patient-namespaced storage path to hand back to /api/files/process.
 */
export async function POST(req: Request): Promise<Response> {
  // patientId is auth-derived, never client-supplied — the upload path is
  // namespaced to it (9.6:2755 + the 9.4 trust boundary).
  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = signUploadSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  const path = buildUploadPath(patientId, parsed.data.filename);

  try {
    const { signedUrl, token } = await createSignedUploadUrl(path);
    return Response.json({ signedUrl, token, path });
  } catch (err) {
    logger.error({
      op: "files.sign",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to create upload URL");
  }
}
