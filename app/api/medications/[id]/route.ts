import { medicationQueries } from "@/db/queries/medication";
import { apiError } from "@/lib/api/error";
import { parseJsonBody, validateUuidParam } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { updateMedicationSchema } from "@/lib/schemas/api/medication";

// postgres-js (transitively imported via medicationQueries → @/db) requires Node.
export const runtime = "nodejs";

// PATCH refuses the four medicationChangeField enum fields. Per-field guidance
// lives here (not in the Zod schema) so the rejection response can carry a
// structured `details` object keyed by field name — error responses as a
// teaching surface (see memory: error-response-teaching-surface).
//
// `/resume` is referenced but unimplemented in v1; pause→active transition
// ships in v1.5 alongside the broader status state-machine.
const CLINICAL_FIELD_GUIDANCE: Record<string, string> = {
  currentDose: "Use POST /api/medications/[id]/changes",
  currentFrequency: "Use POST /api/medications/[id]/changes",
  prescribingDoctor: "Use POST /api/medications/[id]/changes",
  status:
    "Use POST /api/medications/[id]/discontinue. (Resume from paused → active is v1.5.)",
};

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "medication id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    const medication = await medicationQueries.getById(patientId, idCheck.id);
    if (!medication) {
      return apiError("not_found", "Medication not found");
    }
    return Response.json({ medication });
  } catch (err) {
    logger.error({
      op: "medications.get",
      code: errorCode(err),
      ids: { patientId, medicationId: idCheck.id },
    });
    return apiError("server_error", "Failed to read medication");
  }
}

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "medication id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;
  const raw = body.data;

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return apiError("validation_failed", "Request body must be a JSON object");
  }

  const rejectedFields: Record<string, string> = {};
  for (const key of Object.keys(raw)) {
    if (key in CLINICAL_FIELD_GUIDANCE) {
      rejectedFields[key] = CLINICAL_FIELD_GUIDANCE[key];
    }
  }
  if (Object.keys(rejectedFields).length > 0) {
    return apiError(
      "validation_failed",
      "Clinical-event fields must be updated via dedicated endpoints",
      { rejectedFields },
    );
  }

  const parsed = updateMedicationSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const medication = await medicationQueries.update(
      patientId,
      idCheck.id,
      parsed.data,
    );
    if (!medication) {
      return apiError("not_found", "Medication not found");
    }
    return Response.json({ medication });
  } catch (err) {
    logger.error({
      op: "medications.update",
      code: errorCode(err),
      ids: { patientId, medicationId: idCheck.id },
    });
    return apiError("server_error", "Failed to update medication");
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "medication id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    const deleted = await medicationQueries.delete(patientId, idCheck.id);
    if (!deleted) {
      return apiError("not_found", "Medication not found");
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    logger.error({
      op: "medications.delete",
      code: errorCode(err),
      ids: { patientId, medicationId: idCheck.id },
    });
    return apiError("server_error", "Failed to delete medication");
  }
}
