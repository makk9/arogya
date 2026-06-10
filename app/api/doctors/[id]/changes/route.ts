import { DoctorDomainError, doctorChangeQueries } from "@/db/queries/doctor";
import { apiError } from "@/lib/api/error";
import {
  coerceChangedAt,
  parseJsonBody,
  validateUuidParam,
} from "@/lib/api/route-helpers";
import { getCurrentPatient, getCurrentUser } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { createDoctorChangeSchema } from "@/lib/schemas/api/doctor";

// postgres-js (transitively imported via doctorChangeQueries → @/db) requires
// Node.
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

// Simpler than the Condition sibling: Doctor changes carry free-text values
// (specialty / clinic), so there are no transition guards and no linked-entity
// validation — the only domain error is not_found.
export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "doctor id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();
  const { userId: recordedBy } = await getCurrentUser();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const bodyParsed = createDoctorChangeSchema.safeParse(body.data);
  if (!bodyParsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      bodyParsed.error.flatten(),
    );
  }
  const input = bodyParsed.data;

  try {
    const result = await doctorChangeQueries.create(patientId, idCheck.id, {
      field: input.field,
      newValue: input.newValue,
      reason: input.reason,
      changedAt: coerceChangedAt(input.changedAt),
      recordedBy,
    });
    return Response.json(result);
  } catch (err) {
    if (err instanceof DoctorDomainError && err.kind === "not_found") {
      return apiError("not_found", "Doctor not found");
    }
    logger.error({
      op: "doctors.change.create",
      code: errorCode(err),
      ids: { patientId, doctorId: idCheck.id },
    });
    return apiError("server_error", "Failed to log doctor change");
  }
}
