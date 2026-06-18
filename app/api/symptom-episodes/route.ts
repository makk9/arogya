import {
  SymptomDomainError,
  symptomEpisodeQueries,
  type EpisodeTypeRef,
} from "@/db/queries/symptom";
import { apiError } from "@/lib/api/error";
import { fieldErrorsFromReason, parseJsonBody } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { createSymptomEpisodeSchema } from "@/lib/schemas/api/symptom";

// postgres-js (transitively via symptomEpisodeQueries → @/db) requires Node.
export const runtime = "nodejs";

// create() can reject FK targets that are out of patient scope.
const LINKED_ENTITY_MESSAGES: Record<string, string> = {
  symptom_type_not_found: "Symptom type not found in this patient's record.",
  visit_not_found: "Linked visit not found in this patient's record.",
  vital_not_found:
    "A linked reading isn't in this patient's record anymore.",
};

export async function POST(req: Request): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = createSymptomEpisodeSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  const data = parsed.data;
  // The schema's refine guarantees exactly one of newType / symptomTypeId; the
  // explicit branches let TS narrow without a non-null assertion, and the final
  // else is a real backstop if that refine is ever loosened.
  let typeRef: EpisodeTypeRef;
  if (data.newType) {
    typeRef = {
      kind: "new",
      name: data.newType.name,
      bodyArea: data.newType.bodyArea,
    };
  } else if (data.symptomTypeId) {
    typeRef = { kind: "existing", symptomTypeId: data.symptomTypeId };
  } else {
    return apiError(
      "validation_failed",
      "Provide exactly one of symptomTypeId or newType.",
    );
  }

  try {
    const { episode } = await symptomEpisodeQueries.create(patientId, typeRef, {
      startedAt: new Date(data.startedAt),
      endedAt: data.endedAt ? new Date(data.endedAt) : undefined,
      durationMinutes: data.durationMinutes,
      severity: data.severity,
      description: data.description,
      triggers: data.triggers,
      relief: data.relief,
      linkedVitalIds: data.linkedVitalIds,
      linkedVisitId: data.linkedVisitId,
      notes: data.notes,
    });
    return Response.json({ episode }, { status: 201 });
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
      op: "symptomEpisodes.create",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to log symptom episode");
  }
}
