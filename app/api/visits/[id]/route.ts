import { VisitDomainError, visitQueries } from "@/db/queries/visit";
import { apiError } from "@/lib/api/error";
import {
  fieldErrorsFromReason,
  parseJsonBody,
  validateUuidParam,
} from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { updateVisitSchema } from "@/lib/schemas/api/visit";

// postgres-js (transitively imported via visitQueries → @/db) requires Node.
export const runtime = "nodejs";

// No clinical-field refusal map (unlike the state entities): Visit has no
// change log, so every column is plainly PATCH-able — §6.7's Edit corrects the
// event row in place.

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "visit id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    const visit = await visitQueries.getById(patientId, idCheck.id);
    if (!visit) {
      return apiError("not_found", "Visit not found");
    }
    return Response.json({ visit });
  } catch (err) {
    logger.error({
      op: "visits.get",
      code: errorCode(err),
      ids: { patientId, visitId: idCheck.id },
    });
    return apiError("server_error", "Failed to read visit");
  }
}

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "visit id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = updateVisitSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const visit = await visitQueries.update(patientId, idCheck.id, parsed.data);
    if (!visit) {
      return apiError("not_found", "Visit not found");
    }
    return Response.json({ visit });
  } catch (err) {
    // update() scope-checks a PATCHed doctorId (same guard as create).
    if (
      err instanceof VisitDomainError &&
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
      op: "visits.update",
      code: errorCode(err),
      ids: { patientId, visitId: idCheck.id },
    });
    return apiError("server_error", "Failed to update visit");
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "visit id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    // Outcome backlinks are all onDelete:"set null" — the delete detaches
    // outcomes (med changes, labs, reports, episodes) but never removes them.
    const deleted = await visitQueries.delete(patientId, idCheck.id);
    if (!deleted) {
      return apiError("not_found", "Visit not found");
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    logger.error({
      op: "visits.delete",
      code: errorCode(err),
      ids: { patientId, visitId: idCheck.id },
    });
    return apiError("server_error", "Failed to delete visit");
  }
}
