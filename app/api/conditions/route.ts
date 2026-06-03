import { ConditionDomainError, conditionQueries } from "@/db/queries/condition";
import { apiError } from "@/lib/api/error";
import { fieldErrorsFromReason, parseJsonBody } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import {
  createConditionSchema,
  listConditionsQuerySchema,
} from "@/lib/schemas/api/condition";

// postgres-js (transitively imported via conditionQueries → @/db) requires Node.
export const runtime = "nodejs";

// create() can reject diagnosedBy / managingDoctor that are out of patient scope.
const CREATE_LINKED_ENTITY_MESSAGES: Record<string, string> = {
  doctor_not_found: "Doctor not found in this patient's record.",
};

export async function GET(req: Request): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const queryParsed = listConditionsQuerySchema.safeParse(
    statusParam !== null ? { status: statusParam } : {},
  );
  if (!queryParsed.success) {
    return apiError(
      "validation_failed",
      "Invalid query parameters",
      queryParsed.error.flatten(),
    );
  }

  try {
    const conditions = queryParsed.data.status
      ? await conditionQueries.byStatus(patientId, queryParsed.data.status)
      : await conditionQueries.forPatient(patientId);
    return Response.json({ conditions });
  } catch (err) {
    logger.error({ op: "conditions.list", code: errorCode(err), ids: { patientId } });
    return apiError("server_error", "Failed to list conditions");
  }
}

export async function POST(req: Request): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = createConditionSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const condition = await conditionQueries.create({ ...parsed.data, patientId });
    return Response.json({ condition }, { status: 201 });
  } catch (err) {
    if (
      err instanceof ConditionDomainError &&
      err.kind === "linked_entity_invalid"
    ) {
      return apiError(
        "validation_failed",
        "Invalid linked entity",
        fieldErrorsFromReason(err.meta ?? {}, CREATE_LINKED_ENTITY_MESSAGES),
      );
    }
    logger.error({ op: "conditions.create", code: errorCode(err), ids: { patientId } });
    return apiError("server_error", "Failed to create condition");
  }
}
