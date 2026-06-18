import { VitalDomainError, vitalQueries } from "@/db/queries/vital";
import { apiError } from "@/lib/api/error";
import { fieldErrorsFromReason, parseJsonBody } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { createVitalReadingSchema } from "@/lib/schemas/api/vital-reading";

// postgres-js (transitively via vitalQueries → @/db) requires Node.
export const runtime = "nodejs";

// create() can reject a linkedSymptomId that is out of patient scope.
const LINKED_ENTITY_MESSAGES: Record<string, string> = {
  symptom_episode_not_found:
    "Linked symptom episode not found in this patient's record.",
};

// Backs the symptom form's "Linked vital" autocomplete (existing readings) —
// the one reason this list endpoint exists despite vitals having no list page.
export async function GET(): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  try {
    const readings = await vitalQueries.forPatient(patientId);
    return Response.json({ readings });
  } catch (err) {
    logger.error({
      op: "vitalReadings.list",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to list vital readings");
  }
}

export async function POST(req: Request): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = createVitalReadingSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  const { recordedAt, ...rest } = parsed.data;

  try {
    const reading = await vitalQueries.create({
      ...rest,
      patientId,
      // ISO-8601 string → Date for the timestamptz column (Drizzle mode "date").
      recordedAt: new Date(recordedAt),
    });
    return Response.json({ reading }, { status: 201 });
  } catch (err) {
    if (
      err instanceof VitalDomainError &&
      err.kind === "linked_entity_invalid"
    ) {
      return apiError(
        "validation_failed",
        "Invalid linked entity",
        fieldErrorsFromReason(err.meta ?? {}, LINKED_ENTITY_MESSAGES),
      );
    }
    logger.error({
      op: "vitalReadings.create",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to create vital reading");
  }
}
