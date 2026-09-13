import { VitalDomainError, vitalQueries } from "@/db/queries/vital";
import { apiError } from "@/lib/api/error";
import { parseJsonBody, validateUuidParam } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { updateVitalReadingSchema } from "@/lib/schemas/api/vital-reading";

// postgres-js (transitively via vitalQueries → @/db) requires Node.
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

// In-place correction of a logged reading (decisions.md 2026-09-13 — supersedes
// §4:433's delete-and-re-enter rule). No change log, same as a lab marker
// correction. readingType is not correctable (see updateVitalReadingSchema).
export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "vital reading id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = updateVitalReadingSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  // recordedAt is timestamptz (Drizzle mode "date") — convert the ISO string.
  const { recordedAt, ...rest } = parsed.data;
  const values = {
    ...rest,
    ...(recordedAt !== undefined ? { recordedAt: new Date(recordedAt) } : {}),
  };

  try {
    const reading = await vitalQueries.update(patientId, idCheck.id, values);
    if (!reading) {
      return apiError("not_found", "Vital reading not found");
    }
    return Response.json({ reading });
  } catch (err) {
    if (
      err instanceof VitalDomainError &&
      err.kind === "secondary_not_allowed"
    ) {
      return apiError("validation_failed", "Invalid reading value", {
        fieldErrors: {
          valueSecondary: ["Only a blood pressure reading has a second value."],
        },
      });
    }
    logger.error({
      op: "vitalReadings.update",
      code: errorCode(err),
      ids: { patientId, vitalReadingId: idCheck.id },
    });
    return apiError("server_error", "Failed to update vital reading");
  }
}

// DELETE removes a reading outright. linkedSymptomId on an episode's
// `linked_vital_ids` array is not an FK, so the delete scrubs the id from
// episodes in the same transaction (vitalQueries.delete).
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
