import { VisitDomainError, visitQueries } from "@/db/queries/visit";
import { apiError } from "@/lib/api/error";
import { fieldErrorsFromReason, parseJsonBody } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import {
  createVisitSchema,
  listVisitsQuerySchema,
} from "@/lib/schemas/api/visit";

// postgres-js (transitively imported via visitQueries → @/db) requires Node.
export const runtime = "nodejs";

// create() / update() can reject a doctorId that is out of patient scope.
const LINKED_ENTITY_MESSAGES: Record<string, string> = {
  doctor_not_found: "Doctor not found in this patient's record.",
};

export async function GET(req: Request): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  const url = new URL(req.url);
  const doctorParam = url.searchParams.get("doctor");
  const queryParsed = listVisitsQuerySchema.safeParse(
    doctorParam !== null ? { doctor: doctorParam } : {},
  );
  if (!queryParsed.success) {
    return apiError(
      "validation_failed",
      "Invalid query parameters",
      queryParsed.error.flatten(),
    );
  }

  try {
    const visits = queryParsed.data.doctor
      ? await visitQueries.byDoctor(patientId, queryParsed.data.doctor)
      : await visitQueries.forPatient(patientId);
    return Response.json({ visits });
  } catch (err) {
    logger.error({ op: "visits.list", code: errorCode(err), ids: { patientId } });
    return apiError("server_error", "Failed to list visits");
  }
}

export async function POST(req: Request): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = createVisitSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const visit = await visitQueries.create({ ...parsed.data, patientId });
    return Response.json({ visit }, { status: 201 });
  } catch (err) {
    if (
      err instanceof VisitDomainError &&
      err.kind === "linked_entity_invalid"
    ) {
      return apiError(
        "validation_failed",
        "Invalid linked entity",
        fieldErrorsFromReason(err.meta ?? {}, LINKED_ENTITY_MESSAGES),
      );
    }
    logger.error({ op: "visits.create", code: errorCode(err), ids: { patientId } });
    return apiError("server_error", "Failed to create visit");
  }
}
