import { z } from "zod";

import {
  MedicationDomainError,
  medicationQueries,
} from "@/db/queries/medication";
import { apiError } from "@/lib/api/error";
import { getCurrentPatient } from "@/lib/auth";
import { discontinueMedicationSchema } from "@/lib/schemas/api/medication";

// postgres-js (transitively imported via medicationQueries → @/db) requires Node.
export const runtime = "nodejs";

const idPathParamSchema = z.string().uuid();

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const { id: rawId } = await ctx.params;
  const idParsed = idPathParamSchema.safeParse(rawId);
  if (!idParsed.success) {
    return apiError("validation_failed", "Invalid medication id");
  }

  const { patientId, timezone } = await getCurrentPatient();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError("validation_failed", "Request body is not valid JSON");
  }

  const bodyParsed = discontinueMedicationSchema.safeParse(raw);
  if (!bodyParsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      bodyParsed.error.flatten(),
    );
  }

  try {
    const medication = await medicationQueries.discontinue(
      patientId,
      idParsed.data,
      { ...bodyParsed.data, timezone },
    );
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
    return apiError("server_error", "Failed to discontinue medication");
  }
}
