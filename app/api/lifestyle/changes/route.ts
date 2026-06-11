import {
  LifestyleDomainError,
  lifestyleChangeQueries,
} from "@/db/queries/lifestyle";
import { apiError } from "@/lib/api/error";
import { coerceChangedAt, parseJsonBody } from "@/lib/api/route-helpers";
import { getCurrentPatient, getCurrentUser } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { createLifestyleChangeSchema } from "@/lib/schemas/api/lifestyle";

// postgres-js (transitively imported via lifestyleChangeQueries → @/db)
// requires Node.
export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const { patientId } = await getCurrentPatient();
  const { userId: recordedBy } = await getCurrentUser();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const bodyParsed = createLifestyleChangeSchema.safeParse(body.data);
  if (!bodyParsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      bodyParsed.error.flatten(),
    );
  }
  const input = bodyParsed.data;

  try {
    const result = await lifestyleChangeQueries.create(patientId, {
      field: input.field,
      newValue: input.newValue,
      reason: input.reason,
      changedAt: coerceChangedAt(input.changedAt),
      recordedBy,
    });
    return Response.json(result);
  } catch (err) {
    if (err instanceof LifestyleDomainError) {
      if (err.kind === "value_unchanged") {
        return apiError(
          "invalid_state_transition",
          "That value is already set — nothing to change.",
          {
            field: err.meta?.field,
            currentValue: err.meta?.currentValue,
          },
        );
      }
      if (err.kind === "field_locked") {
        // Defensive: field_locked is a PATCH-path error and can't arise here,
        // but the kind is mapped so a future code path doesn't silently 500.
        return apiError("validation_failed", "Invalid lifestyle change");
      }
      // Exhaustiveness: a future LifestyleDomainError kind that isn't mapped
      // above surfaces here as a compile error rather than silently 500ing.
      const _exhaust: never = err.kind;
      void _exhaust;
    }
    logger.error({
      op: "lifestyle.change.create",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to log lifestyle change");
  }
}
