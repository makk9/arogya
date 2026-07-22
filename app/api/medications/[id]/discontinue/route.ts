import {
  MedicationDomainError,
  medicationQueries,
} from "@/db/queries/medication";
import { apiError } from "@/lib/api/error";
import { parseJsonBody, validateUuidParam } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { scheduleInsightGeneration } from "@/lib/insights/schedule";
import { errorCode, logger } from "@/lib/logger";
import { discontinueMedicationSchema } from "@/lib/schemas/api/medication";

// postgres-js (transitively imported via medicationQueries → @/db) requires Node.
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "medication id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId, timezone } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const bodyParsed = discontinueMedicationSchema.safeParse(body.data);
  if (!bodyParsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      bodyParsed.error.flatten(),
    );
  }

  try {
    const medication = await medicationQueries.discontinue(patientId, idCheck.id, {
      ...bodyParsed.data,
      timezone,
    });
    // Stopping a med is a significant state change (§5.6) — e.g. a gap or
    // pattern may hinge on it.
    scheduleInsightGeneration(patientId, { type: "med", id: idCheck.id });
    return Response.json({ medication });
  } catch (err) {
    if (err instanceof MedicationDomainError) {
      if (err.kind === "not_found") {
        return apiError("not_found", "Medication not found");
      }
      if (err.kind === "already_discontinued") {
        return apiError(
          "invalid_state_transition",
          "Medication is already discontinued",
          {
            currentStatus: err.meta?.currentStatus,
            discontinuedOn: err.meta?.discontinuedOn,
          },
        );
      }
      // The remaining kinds (medication_discontinued, invalid_status_transition,
      // linked_entity_invalid) are owned by the /changes route's helper, never
      // raised by discontinue(). Fall through to server_error if one surfaces
      // here — a sign the helper changed shape without updating this route.
      if (
        err.kind === "medication_discontinued" ||
        err.kind === "invalid_status_transition" ||
        err.kind === "linked_entity_invalid"
      ) {
        // Intentional fall-through to server_error below.
      } else {
        const _exhaust: never = err.kind;
        void _exhaust;
      }
    }
    logger.error({
      op: "medications.discontinue",
      code: errorCode(err),
      ids: { patientId, medicationId: idCheck.id },
    });
    return apiError("server_error", "Failed to discontinue medication");
  }
}
