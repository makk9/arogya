import {
  AllergyDomainError,
  allergyChangeQueries,
} from "@/db/queries/allergy";
import { apiError } from "@/lib/api/error";
import {
  coerceChangedAt,
  parseJsonBody,
  validateUuidParam,
} from "@/lib/api/route-helpers";
import { getCurrentPatient, getCurrentUser } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { createAllergyChangeSchema } from "@/lib/schemas/api/allergy";

// postgres-js (transitively imported via allergyChangeQueries → @/db)
// requires Node.
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "allergy id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();
  const { userId: recordedBy } = await getCurrentUser();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const bodyParsed = createAllergyChangeSchema.safeParse(body.data);
  if (!bodyParsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      bodyParsed.error.flatten(),
    );
  }
  const input = bodyParsed.data;

  try {
    const result = await allergyChangeQueries.create(patientId, idCheck.id, {
      field: input.field,
      newValue: input.newValue,
      reason: input.reason,
      changedAt: coerceChangedAt(input.changedAt),
      recordedBy,
    });
    return Response.json(result);
  } catch (err) {
    if (err instanceof AllergyDomainError) {
      if (err.kind === "not_found") {
        return apiError("not_found", "Allergy not found");
      }
      if (err.kind === "status_unchanged") {
        return apiError(
          "invalid_state_transition",
          "That status is already set — nothing to change.",
          { currentStatus: err.meta?.currentStatus },
        );
      }
      if (err.kind === "linked_entity_invalid") {
        // Defensive: no linked-entity field exists on allergy changes today
        // (status / severity only), but the kind is mapped so a future field
        // doesn't silently 500.
        return apiError("validation_failed", "Invalid linked entity");
      }
      // Exhaustiveness: a future AllergyDomainError kind that isn't mapped
      // above surfaces here as a compile error rather than silently 500ing.
      const _exhaust: never = err.kind;
      void _exhaust;
    }
    logger.error({
      op: "allergies.change.create",
      code: errorCode(err),
      ids: { patientId, allergyId: idCheck.id },
    });
    return apiError("server_error", "Failed to log allergy change");
  }
}
