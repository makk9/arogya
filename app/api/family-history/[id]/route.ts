import { familyHistoryQueries } from "@/db/queries/family-history";
import { apiError } from "@/lib/api/error";
import { parseJsonBody, validateUuidParam } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { updateFamilyHistorySchema } from "@/lib/schemas/api/family-history";

// postgres-js (transitively imported via familyHistoryQueries → @/db)
// requires Node.
export const runtime = "nodejs";

// No clinical-field refusal map here, alone among the state entities:
// FamilyHistory has no change log (§4:558), so every column is plain
// PATCH-editable — there are no fields to route through a /changes endpoint.

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "family history id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    const entry = await familyHistoryQueries.getById(patientId, idCheck.id);
    if (!entry) {
      return apiError("not_found", "Family history entry not found");
    }
    return Response.json({ entry });
  } catch (err) {
    logger.error({
      op: "familyHistory.get",
      code: errorCode(err),
      ids: { patientId, familyHistoryId: idCheck.id },
    });
    return apiError("server_error", "Failed to read family history entry");
  }
}

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "family history id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = updateFamilyHistorySchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const entry = await familyHistoryQueries.update(
      patientId,
      idCheck.id,
      parsed.data,
    );
    if (!entry) {
      return apiError("not_found", "Family history entry not found");
    }
    return Response.json({ entry });
  } catch (err) {
    logger.error({
      op: "familyHistory.update",
      code: errorCode(err),
      ids: { patientId, familyHistoryId: idCheck.id },
    });
    return apiError("server_error", "Failed to update family history entry");
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "family history id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    const deleted = await familyHistoryQueries.delete(patientId, idCheck.id);
    if (!deleted) {
      return apiError("not_found", "Family history entry not found");
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    logger.error({
      op: "familyHistory.delete",
      code: errorCode(err),
      ids: { patientId, familyHistoryId: idCheck.id },
    });
    return apiError("server_error", "Failed to delete family history entry");
  }
}
