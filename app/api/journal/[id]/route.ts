import { journalQueries } from "@/db/queries/journal";
import { apiError } from "@/lib/api/error";
import { parseJsonBody, validateUuidParam } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { updateJournalSchema } from "@/lib/schemas/api/journal";

// postgres-js (transitively imported via journalQueries → @/db) requires Node.
export const runtime = "nodejs";

// No clinical-field refusal map (unlike the state entities): JournalEntry has no
// change log, so every column is plainly PATCH-able — §6.7's Edit corrects the
// event row in place.

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "journal entry id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    const entry = await journalQueries.getById(patientId, idCheck.id);
    if (!entry) {
      return apiError("not_found", "Journal entry not found");
    }
    return Response.json({ entry });
  } catch (err) {
    logger.error({
      op: "journal.get",
      code: errorCode(err),
      ids: { patientId, entryId: idCheck.id },
    });
    return apiError("server_error", "Failed to read journal entry");
  }
}

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "journal entry id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = updateJournalSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const entry = await journalQueries.update(patientId, idCheck.id, parsed.data);
    if (!entry) {
      return apiError("not_found", "Journal entry not found");
    }
    return Response.json({ entry });
  } catch (err) {
    logger.error({
      op: "journal.update",
      code: errorCode(err),
      ids: { patientId, entryId: idCheck.id },
    });
    return apiError("server_error", "Failed to update journal entry");
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "journal entry id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    const deleted = await journalQueries.delete(patientId, idCheck.id);
    if (!deleted) {
      return apiError("not_found", "Journal entry not found");
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    logger.error({
      op: "journal.delete",
      code: errorCode(err),
      ids: { patientId, entryId: idCheck.id },
    });
    return apiError("server_error", "Failed to delete journal entry");
  }
}
