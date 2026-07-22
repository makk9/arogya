import { z } from "zod";

import { entityRefsInScope } from "@/db/queries/entity-links";
import { apiError } from "@/lib/api/error";
import { parseJsonBody } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { scheduleInsightGeneration } from "@/lib/insights/schedule";
import { errorCode, logger } from "@/lib/logger";

// postgres-js (transitively via the queries) requires Node.
export const runtime = "nodejs";

// patientId is auth-derived (§9.6), never read from the body — the §9.3 sketch
// that shows it in the body is illustrative; the /api/chat precedent
// (decisions.md 2026-06-01) is normative.
const generateRequestSchema = z.object({
  trigger: z.object({
    type: z.string().min(1),
    id: z.string().uuid(),
  }),
});

/**
 * Fire-and-forget insight generation (§9.3). Thin wrapper over the same
 * scheduler the server-side triggers call directly — exists for manual/dev
 * invocation and any future client-side trigger. Returns 202 immediately; the
 * run happens after the response.
 */
export async function POST(req: Request): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = generateRequestSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  const { trigger } = parsed.data;

  try {
    // The trigger becomes `triggered_by` on any written insight — verify the
    // claimed entity actually exists in this patient's vault before scheduling.
    const valid = await entityRefsInScope(patientId, [trigger]);
    if (!valid.has(`${trigger.type}:${trigger.id}`)) {
      return apiError("validation_failed", "Unknown trigger entity", {
        trigger: ["No entity of that type and id exists in this record."],
      });
    }

    scheduleInsightGeneration(patientId, trigger);
    return Response.json({ accepted: true }, { status: 202 });
  } catch (err) {
    logger.error({
      op: "insights.generate.request",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to schedule insight generation");
  }
}
