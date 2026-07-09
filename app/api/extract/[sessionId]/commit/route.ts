import { extractionSessionQueries } from "@/db/queries";
import { apiError } from "@/lib/api/error";
import { parseJsonBody, validateUuidParam } from "@/lib/api/route-helpers";
import { getCurrentPatient, getCurrentUser } from "@/lib/auth";
import { todayInTimezone } from "@/lib/datetime";
import {
  commitCard,
  type CommitCardResult,
  type CommitContext,
} from "@/lib/extraction/commit";
import { errorCode, logger } from "@/lib/logger";
import { commitRequestSchema } from "@/lib/schemas/api/extract-commit";

// db writes + extraction commit require Node.
export const runtime = "nodejs";

/**
 * POST /api/extract/[sessionId]/commit — the E3 human-in-the-loop write (§6.11).
 * The only path that turns extraction output into vault rows; extraction itself
 * never writes (§5.4:752 tripwire). The client sends the cards it's committing
 * with their user-resolved data; each is mapped + written with a source link to
 * the session's Report. `finalize` (set on the last card) flips the session +
 * report to `committed` once everything in this request succeeds.
 *
 * A per-card commit that's *blocked* (missing field, unmatchable ref) is not a
 * request error — it comes back as `{ ok: false, error }` in `results` for the
 * card to show; the request still succeeds for the cards that committed.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const param = await validateUuidParam(ctx.params, "sessionId", "session id");
  if (!param.ok) return param.response;

  const { patientId, timezone } = await getCurrentPatient();
  const { userId } = await getCurrentUser();

  const session = await extractionSessionQueries.getById(patientId, param.id);
  if (!session) return apiError("not_found", "Extraction session not found");
  if (session.status === "failed") {
    return apiError(
      "invalid_state_transition",
      "This extraction failed — there's nothing to commit. Try a different file or enter it manually.",
    );
  }
  if (session.status === "committed") {
    return apiError(
      "invalid_state_transition",
      "This extraction has already been committed.",
    );
  }

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;
  const parsed = commitRequestSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError("validation_failed", "Invalid commit request", parsed.error.flatten());
  }

  const commitCtx: CommitContext = {
    patientId,
    userId,
    reportId: session.reportId,
    today: todayInTimezone(timezone),
    nowIso: new Date().toISOString(),
  };

  let results: CommitCardResult[];
  try {
    // Sequential: a source rarely has many cards, and ordering keeps any shared
    // side effects (e.g. a symptom type born from the first episode, reused by
    // the second) deterministic.
    results = [];
    for (const card of parsed.data.cards) {
      results.push(await commitCard(commitCtx, card));
    }
  } catch (err) {
    logger.error({
      op: "extract.commit",
      code: errorCode(err),
      ids: { patientId, sessionId: param.id },
    });
    return apiError("server_error", "Something went wrong committing this extraction");
  }

  const allCommitted = results.every((r) => r.ok);
  let finalized = false;
  if (parsed.data.finalize && allCommitted) {
    try {
      await extractionSessionQueries.markCommitted({
        sessionId: session.id,
        reportId: session.reportId,
        patientId,
      });
      finalized = true;
      // E5 seam: fire-and-forget debounced insight generation here once the
      // insight generator + /api/insights/generate endpoint land (§5.6 / §9.3).
      // Committing real entities is exactly the "significant entity creation"
      // trigger it debounces on — see docs/progress.md.
    } catch (err) {
      logger.error({
        op: "extract.commit.finalize",
        code: errorCode(err),
        ids: { patientId, sessionId: param.id },
      });
      // Entities already wrote; report the partial state rather than 500.
    }
  }

  return Response.json({ results, finalized });
}
