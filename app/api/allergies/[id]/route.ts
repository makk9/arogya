import { AllergyDomainError, allergyQueries } from "@/db/queries/allergy";
import { apiError } from "@/lib/api/error";
import {
  fieldErrorsFromReason,
  parseJsonBody,
  validateUuidParam,
} from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { updateAllergySchema } from "@/lib/schemas/api/allergy";

// postgres-js (transitively imported via allergyQueries → @/db) requires Node.
export const runtime = "nodejs";

// PATCH refuses the two change-logged fields (§6.5:1402 Allergy History axes).
// Per-field guidance lives here (not in the Zod schema) so the rejection
// response carries a structured `details` object keyed by field name — error
// responses as a teaching surface.
const CLINICAL_FIELD_GUIDANCE: Record<string, string> = {
  status: "Use POST /api/allergies/[id]/changes",
  severity: "Use POST /api/allergies/[id]/changes",
};

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "allergy id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    const allergy = await allergyQueries.getById(patientId, idCheck.id);
    if (!allergy) {
      return apiError("not_found", "Allergy not found");
    }
    return Response.json({ allergy });
  } catch (err) {
    logger.error({
      op: "allergies.get",
      code: errorCode(err),
      ids: { patientId, allergyId: idCheck.id },
    });
    return apiError("server_error", "Failed to read allergy");
  }
}

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "allergy id");
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

  const parsed = updateAllergySchema.safeParse(raw);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const allergy = await allergyQueries.update(
      patientId,
      idCheck.id,
      parsed.data,
    );
    if (!allergy) {
      return apiError("not_found", "Allergy not found");
    }
    return Response.json({ allergy });
  } catch (err) {
    // update() scope-checks a PATCHed confirmedBy (same guard as create).
    if (
      err instanceof AllergyDomainError &&
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
      op: "allergies.update",
      code: errorCode(err),
      ids: { patientId, allergyId: idCheck.id },
    });
    return apiError("server_error", "Failed to update allergy");
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "allergy id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    const deleted = await allergyQueries.delete(patientId, idCheck.id);
    if (!deleted) {
      return apiError("not_found", "Allergy not found");
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    logger.error({
      op: "allergies.delete",
      code: errorCode(err),
      ids: { patientId, allergyId: idCheck.id },
    });
    return apiError("server_error", "Failed to delete allergy");
  }
}
