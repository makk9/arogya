import { SymptomDomainError, symptomEpisodeQueries } from "@/db/queries/symptom";
import { apiError } from "@/lib/api/error";
import {
  fieldErrorsFromReason,
  parseJsonBody,
  validateUuidParam,
} from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { updateSymptomEpisodeSchema } from "@/lib/schemas/api/symptom";

// postgres-js (transitively via symptomEpisodeQueries → @/db) requires Node.
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const LINKED_ENTITY_MESSAGES: Record<string, string> = {
  visit_not_found: "Linked visit not found in this patient's record.",
  vital_not_found: "A linked reading isn't in this patient's record anymore.",
};

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "symptom episode id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = updateSymptomEpisodeSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  // Timestamptz columns (Drizzle mode "date") need Date objects; the ISO
  // strings from the wire are converted here, the rest pass through.
  const { startedAt, endedAt, ...rest } = parsed.data;
  const values = {
    ...rest,
    ...(startedAt !== undefined ? { startedAt: new Date(startedAt) } : {}),
    ...(endedAt !== undefined
      ? { endedAt: endedAt === null ? null : new Date(endedAt) }
      : {}),
  };

  try {
    const episode = await symptomEpisodeQueries.update(
      patientId,
      idCheck.id,
      values,
    );
    if (!episode) {
      return apiError("not_found", "Symptom episode not found");
    }
    return Response.json({ episode });
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
      op: "symptomEpisodes.update",
      code: errorCode(err),
      ids: { patientId, symptomEpisodeId: idCheck.id },
    });
    return apiError("server_error", "Failed to update symptom episode");
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "symptom episode id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    const deleted = await symptomEpisodeQueries.delete(patientId, idCheck.id);
    if (!deleted) {
      return apiError("not_found", "Symptom episode not found");
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    logger.error({
      op: "symptomEpisodes.delete",
      code: errorCode(err),
      ids: { patientId, symptomEpisodeId: idCheck.id },
    });
    return apiError("server_error", "Failed to delete symptom episode");
  }
}
