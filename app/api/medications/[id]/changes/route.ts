import {
  MedicationDomainError,
  medicationChangeQueries,
} from "@/db/queries/medication";
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
import { createMedicationChangeSchema } from "@/lib/schemas/api/medication";

// postgres-js (transitively imported via medicationChangeQueries → @/db)
// requires Node.
export const runtime = "nodejs";

// linked_entity_invalid reason codes → per-field messages (the shared
// fieldErrorsFromReason routes each under its offending field for RHF setError).
const LINKED_ENTITY_MESSAGES: Record<string, string> = {
  doctor_not_found: "Doctor not found in this patient's record.",
  no_op: "This doctor is already the prescribing doctor.",
  visit_not_found: "Visit not found in this patient's record.",
};

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "medication id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();
  const { userId: recordedBy } = await getCurrentUser();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const bodyParsed = createMedicationChangeSchema.safeParse(body.data);
  if (!bodyParsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      bodyParsed.error.flatten(),
    );
  }
  const input = bodyParsed.data;

  try {
    const result = await medicationChangeQueries.create(patientId, idCheck.id, {
      field: input.field,
      newValue: input.newValue,
      reason: input.reason,
      changedAt: coerceChangedAt(input.changedAt),
      linkedVisitId: input.linkedVisitId,
      recordedBy,
    });
    // A dose/status change is exactly the §1.3 north-star trigger.
    scheduleInsightGeneration(patientId, { type: "med", id: idCheck.id });
    return Response.json(result);
  } catch (err) {
    if (err instanceof MedicationDomainError) {
      if (err.kind === "not_found") {
        return apiError("not_found", "Medication not found");
      }
      if (err.kind === "medication_discontinued") {
        return apiError(
          "invalid_state_transition",
          "Can't log changes on a discontinued medication",
          {
            currentStatus: err.meta?.currentStatus,
            discontinuedOn: err.meta?.discontinuedOn,
          },
        );
      }
      if (err.kind === "invalid_status_transition") {
        return apiError(
          "invalid_state_transition",
          "Only active → paused is supported here. Use Discontinue for active → discontinued.",
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
      if (err.kind === "already_discontinued") {
        // This kind is owned by the discontinue route. If it surfaces here
        // something is wrong with the helper — fall through to server_error.
      }
      // Exhaustiveness: a future MedicationDomainError("kind") that isn't
      // mapped above will surface here as a compile error rather than
      // silently 500ing.
      const _exhaust: never = err.kind as never;
      void _exhaust;
    }
    logger.error({
      op: "medications.change.create",
      code: errorCode(err),
      ids: { patientId, medicationId: idCheck.id },
    });
    return apiError("server_error", "Failed to log medication change");
  }
}
