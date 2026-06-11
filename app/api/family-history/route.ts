import { familyHistoryQueries } from "@/db/queries/family-history";
import { apiError } from "@/lib/api/error";
import { parseJsonBody } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { createFamilyHistorySchema } from "@/lib/schemas/api/family-history";

// postgres-js (transitively imported via familyHistoryQueries → @/db)
// requires Node.
export const runtime = "nodejs";

// No list-query params: §6.4:1343 defines no Family history filter (grouping
// by relation does the work), so GET takes no searchParams.

export async function GET(): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  try {
    const entries = await familyHistoryQueries.forPatient(patientId);
    return Response.json({ entries });
  } catch (err) {
    logger.error({
      op: "familyHistory.list",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to list family history");
  }
}

export async function POST(req: Request): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = createFamilyHistorySchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const entry = await familyHistoryQueries.create({
      ...parsed.data,
      patientId,
    });
    return Response.json({ entry }, { status: 201 });
  } catch (err) {
    logger.error({
      op: "familyHistory.create",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to create family history entry");
  }
}
