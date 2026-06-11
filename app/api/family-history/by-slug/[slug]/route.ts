import { z } from "zod";

import { familyHistoryQueries } from "@/db/queries/family-history";
import { apiError } from "@/lib/api/error";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";

// postgres-js (transitively via familyHistoryQueries → @/db) requires Node.
export const runtime = "nodejs";

// Citation slugs are lowercase alnum + hyphen (`slugify()` output in
// serializers/format.ts). The `family-history:` prefix is stripped by the
// parser before it reaches the pill, so the path param is the bare compound
// slug (slugify of `${relation}-${conditionName}`).
const slugParamSchema = z.string().regex(/^[a-z0-9-]+$/);

type Ctx = { params: Promise<{ slug: string }> };

// Resolves a `§ family-history:<slug>` citation pill to the entry it
// references, for the chat popover preview. Returns only the preview fields
// the popover renders plus the ids needed to build the detail-page link.
export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params;
  const parsed = slugParamSchema.safeParse(slug);
  if (!parsed.success) {
    return apiError("validation_failed", "Invalid family history slug");
  }

  const { patientId } = await getCurrentPatient();

  try {
    const entry = await familyHistoryQueries.bySlug(patientId, parsed.data);
    if (!entry) {
      return apiError("not_found", "Family history entry not found");
    }
    return Response.json({
      entry: {
        id: entry.id,
        patientId: entry.patientId,
        relation: entry.relation,
        relationSpecific: entry.relationSpecific,
        conditionName: entry.conditionName,
        ageOfOnset: entry.ageOfOnset,
        outcome: entry.outcome,
      },
    });
  } catch (err) {
    logger.error({
      op: "familyHistory.bySlug",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to resolve family history entry");
  }
}
