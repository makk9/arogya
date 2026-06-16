import { labResultQueries } from "@/db/queries/lab";
import { apiError } from "@/lib/api/error";
import { parseJsonBody, validateUuidParam } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { correctLabResultSchema } from "@/lib/schemas/api/lab-report";

// postgres-js (transitively via labResultQueries → @/db) requires Node.
export const runtime = "nodejs";

/*
 * §6.7 `+ Log a correction` — amends one already-stored marker. PATCH only;
 * markers are never created or deleted on the report surface (they're created
 * with the report). No `lab_results_changes` table exists, so a correction
 * overwrites the measured fields in place (decision flagged in decisions.md).
 * Scoped by patient + parent report so a foreign resultId can't be reached.
 */

type Ctx = { params: Promise<{ id: string; resultId: string }> };

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const reportCheck = await validateUuidParam(ctx.params, "id", "lab report id");
  if (!reportCheck.ok) return reportCheck.response;
  const resultCheck = await validateUuidParam(
    ctx.params,
    "resultId",
    "lab result id",
  );
  if (!resultCheck.ok) return resultCheck.response;

  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = correctLabResultSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const result = await labResultQueries.correctResult(
      patientId,
      reportCheck.id,
      resultCheck.id,
      parsed.data,
    );
    if (!result) {
      return apiError("not_found", "Lab result not found");
    }
    return Response.json({ result });
  } catch (err) {
    logger.error({
      op: "labResults.correct",
      code: errorCode(err),
      ids: { patientId, labReportId: reportCheck.id, resultId: resultCheck.id },
    });
    return apiError("server_error", "Failed to correct lab result");
  }
}
