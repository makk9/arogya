import { ConditionDomainError, conditionQueries } from "@/db/queries/condition";
import { apiError } from "@/lib/api/error";
import {
  fieldErrorsFromReason,
  parseJsonBody,
  validateUuidParam,
} from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { updateConditionSchema } from "@/lib/schemas/api/condition";

// postgres-js (transitively imported via conditionQueries → @/db) requires Node.
export const runtime = "nodejs";

// PATCH refuses the three change-logged fields. Per-field guidance lives here
// (not in the Zod schema) so the rejection response carries a structured
// `details` object keyed by field name — error responses as a teaching surface
// (see memory: error-response-teaching-surface).
//
// notes is intentionally absent — it is inline-editable via PATCH, not
// change-logged (the Condition divergence from Medication).
const CLINICAL_FIELD_GUIDANCE: Record<string, string> = {
  status: "Use POST /api/conditions/[id]/changes",
  severity: "Use POST /api/conditions/[id]/changes",
  managingDoctor: "Use POST /api/conditions/[id]/changes",
};

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "condition id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    const condition = await conditionQueries.getById(patientId, idCheck.id);
    if (!condition) {
      return apiError("not_found", "Condition not found");
    }
    return Response.json({ condition });
  } catch (err) {
    logger.error({
      op: "conditions.get",
      code: errorCode(err),
      ids: { patientId, conditionId: idCheck.id },
    });
    return apiError("server_error", "Failed to read condition");
  }
}

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "condition id");
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
    // Object.hasOwn, not `in`: `in` walks the prototype chain, so a body key
    // like "constructor" would be misread as a guarded field.
    if (Object.hasOwn(CLINICAL_FIELD_GUIDANCE, key)) {
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

  const parsed = updateConditionSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const condition = await conditionQueries.update(
      patientId,
      idCheck.id,
      parsed.data,
    );
    if (!condition) {
      return apiError("not_found", "Condition not found");
    }
    return Response.json({ condition });
  } catch (err) {
    // update() scope-checks a PATCHed diagnosedBy (same guard as create).
    if (
      err instanceof ConditionDomainError &&
      err.kind === "linked_entity_invalid"
    ) {
      return apiError(
        "validation_failed",
        "Invalid linked entity",
        fieldErrorsFromReason(err.meta ?? {}, {
          doctor_not_found: "Doctor not found in this patient's record.",
        }),
      );
    }
    logger.error({
      op: "conditions.update",
      code: errorCode(err),
      ids: { patientId, conditionId: idCheck.id },
    });
    return apiError("server_error", "Failed to update condition");
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "condition id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    const deleted = await conditionQueries.delete(patientId, idCheck.id);
    if (!deleted) {
      return apiError("not_found", "Condition not found");
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    logger.error({
      op: "conditions.delete",
      code: errorCode(err),
      ids: { patientId, conditionId: idCheck.id },
    });
    return apiError("server_error", "Failed to delete condition");
  }
}
