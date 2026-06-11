import {
  LifestyleDomainError,
  lifestyleQueries,
} from "@/db/queries/lifestyle";
import { apiError } from "@/lib/api/error";
import { parseJsonBody } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { updateLifestyleSchema } from "@/lib/schemas/api/lifestyle";

// postgres-js (transitively imported via lifestyleQueries → @/db) requires
// Node.
export const runtime = "nodejs";

// Singleton routes: no [id] segment and no by-slug sibling. The citation slug
// is the fixed `lifestyle:profile` (serializers/lifestyle.ts), so the pill
// resolves through this GET directly.

export async function GET(): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  try {
    const profile = await lifestyleQueries.getForPatient(patientId);
    if (!profile) {
      return apiError("not_found", "No lifestyle profile recorded yet");
    }
    return Response.json({ profile });
  } catch (err) {
    logger.error({
      op: "lifestyle.get",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to read lifestyle profile");
  }
}

export async function PATCH(req: Request): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = updateLifestyleSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const profile = await lifestyleQueries.update(patientId, parsed.data);
    return Response.json({ profile });
  } catch (err) {
    // Unlike the other entities' static clinical-field refusal, this one is
    // state-dependent: a trend field PATCHes fine while null (first
    // population) and locks once populated. Same teaching-surface shape —
    // per-field guidance keyed by field name.
    if (err instanceof LifestyleDomainError && err.kind === "field_locked") {
      const rejectedFields = Object.fromEntries(
        (err.meta?.fields ?? []).map((f) => [
          f,
          "Already has a value — log a change via POST /api/lifestyle/changes",
        ]),
      );
      return apiError(
        "validation_failed",
        "Populated trend fields must change via the change log",
        { rejectedFields },
      );
    }
    logger.error({
      op: "lifestyle.update",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to update lifestyle profile");
  }
}
