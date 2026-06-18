import { ReportDomainError, reportQueries } from "@/db/queries/report";
import { apiError } from "@/lib/api/error";
import {
  fieldErrorsFromReason,
  parseJsonBody,
  validateUuidParam,
} from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { updateReportSchema } from "@/lib/schemas/api/report";

// postgres-js (transitively imported via reportQueries → @/db) requires Node.
export const runtime = "nodejs";

// No clinical-field refusal map (unlike the state entities): Report has no
// change log, so every column is plainly PATCH-able — §6.7's Edit corrects the
// event row in place.

const LINKED_ENTITY_MESSAGES: Record<string, string> = {
  visit_not_found: "Visit not found in this patient's record.",
  doctor_not_found: "Doctor not found in this patient's record.",
};

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "report id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    const report = await reportQueries.getById(patientId, idCheck.id);
    if (!report) {
      return apiError("not_found", "Report not found");
    }
    return Response.json({ report });
  } catch (err) {
    logger.error({
      op: "reports.get",
      code: errorCode(err),
      ids: { patientId, reportId: idCheck.id },
    });
    return apiError("server_error", "Failed to read report");
  }
}

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "report id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = updateReportSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const report = await reportQueries.update(patientId, idCheck.id, parsed.data);
    if (!report) {
      return apiError("not_found", "Report not found");
    }
    return Response.json({ report });
  } catch (err) {
    // update() scope-checks a PATCHed linkedVisitId / linkedDoctorId (same
    // guard as create).
    if (
      err instanceof ReportDomainError &&
      err.kind === "linked_entity_invalid"
    ) {
      return apiError(
        "validation_failed",
        "Invalid linked entity",
        fieldErrorsFromReason(err.meta ?? {}, LINKED_ENTITY_MESSAGES),
      );
    }
    logger.error({
      op: "reports.update",
      code: errorCode(err),
      ids: { patientId, reportId: idCheck.id },
    });
    return apiError("server_error", "Failed to update report");
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "report id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    // Outcome backlinks (medications / conditions surfaced from the report)
    // carry source_report_id with onDelete:"set null" — the delete detaches
    // those entities but never removes them.
    const deleted = await reportQueries.delete(patientId, idCheck.id);
    if (!deleted) {
      return apiError("not_found", "Report not found");
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    logger.error({
      op: "reports.delete",
      code: errorCode(err),
      ids: { patientId, reportId: idCheck.id },
    });
    return apiError("server_error", "Failed to delete report");
  }
}
