import { ReportDomainError, reportQueries } from "@/db/queries/report";
import { apiError } from "@/lib/api/error";
import { fieldErrorsFromReason, parseJsonBody } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import {
  createReportSchema,
  listReportsQuerySchema,
} from "@/lib/schemas/api/report";

// postgres-js (transitively imported via reportQueries → @/db) requires Node.
export const runtime = "nodejs";

// create() / update() can reject a linkedVisitId / linkedDoctorId out of scope.
const LINKED_ENTITY_MESSAGES: Record<string, string> = {
  visit_not_found: "Visit not found in this patient's record.",
  doctor_not_found: "Doctor not found in this patient's record.",
};

export async function GET(req: Request): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  const url = new URL(req.url);
  const typeParam = url.searchParams.get("reportType");
  const queryParsed = listReportsQuerySchema.safeParse(
    typeParam !== null ? { reportType: typeParam } : {},
  );
  if (!queryParsed.success) {
    return apiError(
      "validation_failed",
      "Invalid query parameters",
      queryParsed.error.flatten(),
    );
  }

  try {
    const reports = queryParsed.data.reportType
      ? await reportQueries.byType(patientId, queryParsed.data.reportType)
      : await reportQueries.forPatient(patientId);
    return Response.json({ reports });
  } catch (err) {
    logger.error({ op: "reports.list", code: errorCode(err), ids: { patientId } });
    return apiError("server_error", "Failed to list reports");
  }
}

export async function POST(req: Request): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = createReportSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const report = await reportQueries.create({ ...parsed.data, patientId });
    return Response.json({ report }, { status: 201 });
  } catch (err) {
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
    logger.error({ op: "reports.create", code: errorCode(err), ids: { patientId } });
    return apiError("server_error", "Failed to create report");
  }
}
