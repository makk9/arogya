import { symptomTypeQueries } from "@/db/queries/symptom";
import { apiError } from "@/lib/api/error";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";

// postgres-js (transitively via symptomTypeQueries → @/db) requires Node.
export const runtime = "nodejs";

// Backs the Log-symptom form's "Symptom type" autocomplete (§6.12:1854 —
// existing types with `+ Create new`). Types have no create route: a new type is
// born inside an episode POST, so only this list endpoint is exposed here.
export async function GET(): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  try {
    const types = await symptomTypeQueries.forPatient(patientId);
    return Response.json({ types });
  } catch (err) {
    logger.error({
      op: "symptomTypes.list",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to list symptom types");
  }
}
