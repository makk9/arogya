import { z } from "zod";

import { conditionQueries } from "@/db/queries/condition";
import { apiError } from "@/lib/api/error";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";

// postgres-js (transitively via conditionQueries → @/db) requires Node.
export const runtime = "nodejs";

// Citation slugs are lowercase alnum + hyphen (`slugify()` output in
// serializers/format.ts). The `condition:` prefix is stripped by the parser
// before it reaches the pill, so the path param is the bare slug.
const slugParamSchema = z.string().regex(/^[a-z0-9-]+$/);

type Ctx = { params: Promise<{ slug: string }> };

// Resolves a `§ condition:<slug>` citation pill to the condition it references,
// for the chat popover preview. Returns only the preview fields the popover
// renders plus the ids needed to build the detail-page link — the chat drawer is
// global, so the pill can't assume the current route's patientId.
//
// Backend half of the Phase D pill wiring: citation-pill.tsx still only treats
// `med:` as interactive; teaching it `condition:` is a separate component slice.
export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params;
  const parsed = slugParamSchema.safeParse(slug);
  if (!parsed.success) {
    return apiError("validation_failed", "Invalid condition slug");
  }

  const { patientId } = await getCurrentPatient();

  try {
    const condition = await conditionQueries.bySlug(patientId, parsed.data);
    if (!condition) {
      return apiError("not_found", "Condition not found");
    }
    return Response.json({
      condition: {
        id: condition.id,
        patientId: condition.patientId,
        name: condition.name,
        status: condition.status,
        severity: condition.severity,
        category: condition.category,
      },
    });
  } catch (err) {
    logger.error({
      op: "conditions.bySlug",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to resolve condition");
  }
}
