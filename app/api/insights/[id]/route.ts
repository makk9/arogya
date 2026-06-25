import { insightQueries } from "@/db/queries/insight";
import { apiError } from "@/lib/api/error";
import { parseJsonBody, validateUuidParam } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { updateInsightSchema } from "@/lib/schemas/api/insight";
import type { NewInsight } from "@/db/schema";

// postgres-js (transitively imported via insightQueries → @/db) requires Node.
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "insight id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    const insight = await insightQueries.getById(patientId, idCheck.id);
    if (!insight) {
      return apiError("not_found", "Insight not found");
    }
    return Response.json({ insight });
  } catch (err) {
    logger.error({
      op: "insights.get",
      code: errorCode(err),
      ids: { patientId, insightId: idCheck.id },
    });
    return apiError("server_error", "Failed to read insight");
  }
}

// PATCH mutates the two user-facing fields: the status lifecycle (§6.9:1607
// action buttons + Restore) and the editorial `notes` (§6.9:1629). Any other
// body key fails .strict(); at least one of status/notes is required. Any
// status → any status is permitted (no transition guard — the lifecycle has no
// side-effecting terminal states), so there is no invalid_state_transition
// path. dismissed_reason is rejected unless status is `dismissed`, and cleared
// in the row on every other status. notes/status update independently — the UI
// sends one at a time (action buttons vs. the inline notes editor).
export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "insight id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = updateInsightSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  const { status, dismissedReason, notes } = parsed.data;
  const patch: Partial<Pick<NewInsight, "status" | "dismissedReason" | "notes">> =
    {};
  if (status !== undefined) {
    patch.status = status;
    // A reason only annotates a dismissal; cleared on every other status.
    patch.dismissedReason = status === "dismissed" ? (dismissedReason ?? null) : null;
  }
  if (notes !== undefined) patch.notes = notes;

  try {
    const insight = await insightQueries.update(patientId, idCheck.id, patch);
    if (!insight) {
      return apiError("not_found", "Insight not found");
    }
    return Response.json({ insight });
  } catch (err) {
    logger.error({
      op: "insights.update",
      code: errorCode(err),
      ids: { patientId, insightId: idCheck.id },
    });
    return apiError("server_error", "Failed to update insight");
  }
}
