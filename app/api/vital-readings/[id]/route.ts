import { vitalQueries } from "@/db/queries/vital";
import { apiError } from "@/lib/api/error";
import { validateUuidParam } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";

// postgres-js (transitively via vitalQueries → @/db) requires Node.
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

// Readings are immutable (§4:433) — no PATCH/correction. DELETE is the only
// mutation: a mistake is removed and re-entered. linkedSymptomId on an episode's
// `linked_vital_ids` array is not an FK, so a deleted reading leaves a dangling
// id the episode rendering filters out (byIds returns only live rows).
export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "vital reading id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    const deleted = await vitalQueries.delete(patientId, idCheck.id);
    if (!deleted) {
      return apiError("not_found", "Vital reading not found");
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    logger.error({
      op: "vitalReadings.delete",
      code: errorCode(err),
      ids: { patientId, vitalReadingId: idCheck.id },
    });
    return apiError("server_error", "Failed to delete vital reading");
  }
}
