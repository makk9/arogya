import { LabDomainError, labReportQueries } from "@/db/queries/lab";
import { apiError } from "@/lib/api/error";
import {
  fieldErrorsFromReason,
  parseJsonBody,
  validateUuidParam,
} from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { updateLabReportSchema } from "@/lib/schemas/api/lab-report";

// postgres-js (transitively via labReportQueries → @/db) requires Node.
export const runtime = "nodejs";

const LINKED_ENTITY_MESSAGES: Record<string, string> = {
  doctor_not_found: "Ordering doctor not found in this patient's record.",
  visit_not_found: "Linked visit not found in this patient's record.",
};

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "lab report id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    const report = await labReportQueries.getById(patientId, idCheck.id);
    if (!report) {
      return apiError("not_found", "Lab report not found");
    }
    return Response.json({ report });
  } catch (err) {
    logger.error({
      op: "labReports.get",
      code: errorCode(err),
      ids: { patientId, labReportId: idCheck.id },
    });
    return apiError("server_error", "Failed to read lab report");
  }
}

// Report-level PATCH only. The MARKERS table is corrected through
// /[id]/results/[resultId] — §6.7 markers are read-only on the report surface.
export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "lab report id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = updateLabReportSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const report = await labReportQueries.update(
      patientId,
      idCheck.id,
      parsed.data,
    );
    if (!report) {
      return apiError("not_found", "Lab report not found");
    }
    return Response.json({ report });
  } catch (err) {
    if (
      err instanceof LabDomainError &&
      err.kind === "linked_entity_invalid"
    ) {
      return apiError(
        "validation_failed",
        "Invalid linked entity",
        fieldErrorsFromReason(err.meta ?? {}, LINKED_ENTITY_MESSAGES),
      );
    }
    logger.error({
      op: "labReports.update",
      code: errorCode(err),
      ids: { patientId, labReportId: idCheck.id },
    });
    return apiError("server_error", "Failed to update lab report");
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "lab report id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    // lab_results cascade with the report; visits that linked to it keep their
    // own rows (the FK is on the visit→nothing direction here).
    const deleted = await labReportQueries.delete(patientId, idCheck.id);
    if (!deleted) {
      return apiError("not_found", "Lab report not found");
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    logger.error({
      op: "labReports.delete",
      code: errorCode(err),
      ids: { patientId, labReportId: idCheck.id },
    });
    return apiError("server_error", "Failed to delete lab report");
  }
}
