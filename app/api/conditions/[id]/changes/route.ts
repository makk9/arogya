import {
  ConditionDomainError,
  conditionChangeQueries,
} from "@/db/queries/condition";
import { apiError } from "@/lib/api/error";
import {
  coerceChangedAt,
  fieldErrorsFromReason,
  parseJsonBody,
  validateUuidParam,
} from "@/lib/api/route-helpers";
import { getCurrentPatient, getCurrentUser } from "@/lib/auth";
import { scheduleInsightGeneration } from "@/lib/insights/schedule";
import { errorCode, logger } from "@/lib/logger";
import { createConditionChangeSchema } from "@/lib/schemas/api/condition";

// postgres-js (transitively imported via conditionChangeQueries → @/db)
// requires Node.
export const runtime = "nodejs";

// linked_entity_invalid reason codes → per-field messages (the shared
// fieldErrorsFromReason routes them under the offending field for RHF setError).
const LINKED_ENTITY_MESSAGES: Record<string, string> = {
  doctor_not_found: "Doctor not found in this patient's record.",
  no_op: "This doctor is already the managing doctor.",
};

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "condition id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();
  const { userId: recordedBy } = await getCurrentUser();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const bodyParsed = createConditionChangeSchema.safeParse(body.data);
  if (!bodyParsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      bodyParsed.error.flatten(),
    );
  }
  const input = bodyParsed.data;

  try {
    const result = await conditionChangeQueries.create(patientId, idCheck.id, {
      field: input.field,
      newValue: input.newValue,
      reason: input.reason,
      changedAt: coerceChangedAt(input.changedAt),
      recordedBy,
    });
    scheduleInsightGeneration(patientId, { type: "condition", id: idCheck.id });
    return Response.json(result);
  } catch (err) {
    if (err instanceof ConditionDomainError) {
      if (err.kind === "not_found") {
        return apiError("not_found", "Condition not found");
      }
      if (err.kind === "status_unchanged") {
        return apiError(
          "invalid_state_transition",
          "That status is already set — nothing to change.",
          { currentStatus: err.meta?.currentStatus },
        );
      }
      if (err.kind === "linked_entity_invalid") {
        return apiError(
          "validation_failed",
          "Invalid linked entity",
          fieldErrorsFromReason(err.meta ?? {}, LINKED_ENTITY_MESSAGES),
        );
      }
      // Exhaustiveness: a future ConditionDomainError kind that isn't mapped
      // above surfaces here as a compile error rather than silently 500ing.
      const _exhaust: never = err.kind;
      void _exhaust;
    }
    logger.error({
      op: "conditions.change.create",
      code: errorCode(err),
      ids: { patientId, conditionId: idCheck.id },
    });
    return apiError("server_error", "Failed to log condition change");
  }
}
