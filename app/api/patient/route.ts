import { patientQueries } from "@/db/queries/patient";
import { apiError } from "@/lib/api/error";
import { parseJsonBody } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { updatePatientSchema } from "@/lib/schemas/api/patient";

// postgres-js (transitively imported via patientQueries → @/db) requires Node.
export const runtime = "nodejs";

// Singleton route: no [id] segment. The current patient is auth-derived, and
// there is no patient citation pill, so no GET / by-slug sibling is needed —
// the profile page reads the row server-side via patientQueries.getById.

export async function PATCH(req: Request): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = updatePatientSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const patient = await patientQueries.update(patientId, parsed.data);
    if (!patient) {
      return apiError("not_found", "Patient not found");
    }
    return Response.json({ patient });
  } catch (err) {
    logger.error({
      op: "patient.update",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to update patient");
  }
}
