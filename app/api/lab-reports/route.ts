import { LabDomainError, labReportQueries } from "@/db/queries/lab";
import { apiError } from "@/lib/api/error";
import { fieldErrorsFromReason, parseJsonBody } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import {
  createLabReportSchema,
  listLabReportsQuerySchema,
} from "@/lib/schemas/api/lab-report";

// postgres-js (transitively via labReportQueries → @/db) requires Node.
export const runtime = "nodejs";

// create() can reject FK targets that are out of patient scope.
const LINKED_ENTITY_MESSAGES: Record<string, string> = {
  doctor_not_found: "Ordering doctor not found in this patient's record.",
  visit_not_found: "Linked visit not found in this patient's record.",
  condition_not_found:
    "A marker references a condition not in this patient's record.",
};

export async function GET(req: Request): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  const url = new URL(req.url);
  const typeParam = url.searchParams.get("reportType");
  const queryParsed = listLabReportsQuerySchema.safeParse(
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
      ? await labReportQueries.byReportType(
          patientId,
          queryParsed.data.reportType,
        )
      : await labReportQueries.forPatient(patientId);
    return Response.json({ reports });
  } catch (err) {
    logger.error({
      op: "labReports.list",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to list lab reports");
  }
}

export async function POST(req: Request): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = createLabReportSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  const { results, ...report } = parsed.data;

  try {
    const created = await labReportQueries.create(
      { ...report, patientId },
      results,
    );
    return Response.json({ report: created }, { status: 201 });
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
      op: "labReports.create",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to create lab report");
  }
}
