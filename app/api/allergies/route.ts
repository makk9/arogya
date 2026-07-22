import { AllergyDomainError, allergyQueries } from "@/db/queries/allergy";
import { apiError } from "@/lib/api/error";
import { fieldErrorsFromReason, parseJsonBody } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { scheduleInsightGeneration } from "@/lib/insights/schedule";
import { errorCode, logger } from "@/lib/logger";
import {
  createAllergySchema,
  listAllergiesQuerySchema,
} from "@/lib/schemas/api/allergy";

// postgres-js (transitively imported via allergyQueries → @/db) requires Node.
export const runtime = "nodejs";

// create() can reject a confirmedBy doctor that is out of patient scope.
const CREATE_LINKED_ENTITY_MESSAGES: Record<string, string> = {
  doctor_not_found: "Doctor not found in this patient's record.",
};

export async function GET(req: Request): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const queryParsed = listAllergiesQuerySchema.safeParse(
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
    const allergies = queryParsed.data.status
      ? await allergyQueries.byStatus(patientId, queryParsed.data.status)
      : await allergyQueries.forPatient(patientId);
    return Response.json({ allergies });
  } catch (err) {
    logger.error({ op: "allergies.list", code: errorCode(err), ids: { patientId } });
    return apiError("server_error", "Failed to list allergies");
  }
}

export async function POST(req: Request): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = createAllergySchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const allergy = await allergyQueries.create({ ...parsed.data, patientId });
    scheduleInsightGeneration(patientId, { type: "allergy", id: allergy.id });
    return Response.json({ allergy }, { status: 201 });
  } catch (err) {
    if (
      err instanceof AllergyDomainError &&
      err.kind === "linked_entity_invalid"
    ) {
      return apiError(
        "validation_failed",
        "Invalid linked entity",
        fieldErrorsFromReason(err.meta ?? {}, CREATE_LINKED_ENTITY_MESSAGES),
      );
    }
    logger.error({ op: "allergies.create", code: errorCode(err), ids: { patientId } });
    return apiError("server_error", "Failed to create allergy");
  }
}
