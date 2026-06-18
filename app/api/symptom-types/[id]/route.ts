import { SymptomDomainError, symptomTypeQueries } from "@/db/queries/symptom";
import { apiError } from "@/lib/api/error";
import {
  fieldErrorsFromReason,
  parseJsonBody,
  validateUuidParam,
} from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { updateSymptomTypeSchema } from "@/lib/schemas/api/symptom";

// postgres-js (transitively via symptomTypeQueries → @/db) requires Node.
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const LINKED_ENTITY_MESSAGES: Record<string, string> = {
  condition_not_found: "Linked condition not found in this patient's record.",
};

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "symptom type id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = updateSymptomTypeSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const type = await symptomTypeQueries.update(patientId, idCheck.id, parsed.data);
    if (!type) {
      return apiError("not_found", "Symptom type not found");
    }
    return Response.json({ type });
  } catch (err) {
    if (
      err instanceof SymptomDomainError &&
      err.kind === "linked_entity_invalid"
    ) {
      return apiError(
        "validation_failed",
        "Invalid linked entity",
        fieldErrorsFromReason(err.meta ?? {}, LINKED_ENTITY_MESSAGES),
      );
    }
    logger.error({
      op: "symptomTypes.update",
      code: errorCode(err),
      ids: { patientId, symptomTypeId: idCheck.id },
    });
    return apiError("server_error", "Failed to update symptom type");
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "symptom type id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    // symptom_episodes.symptom_type_id is onDelete:"cascade" — deleting the type
    // removes its whole episode stream (the dialog warns with the count).
    const deleted = await symptomTypeQueries.delete(patientId, idCheck.id);
    if (!deleted) {
      return apiError("not_found", "Symptom type not found");
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    logger.error({
      op: "symptomTypes.delete",
      code: errorCode(err),
      ids: { patientId, symptomTypeId: idCheck.id },
    });
    return apiError("server_error", "Failed to delete symptom type");
  }
}
