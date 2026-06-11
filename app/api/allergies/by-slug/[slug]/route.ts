import { z } from "zod";

import { allergyQueries } from "@/db/queries/allergy";
import { apiError } from "@/lib/api/error";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";

// postgres-js (transitively via allergyQueries → @/db) requires Node.
export const runtime = "nodejs";

// Citation slugs are lowercase alnum + hyphen (`slugify()` output in
// serializers/format.ts). The `allergy:` prefix is stripped by the parser
// before it reaches the pill, so the path param is the bare slug.
const slugParamSchema = z.string().regex(/^[a-z0-9-]+$/);

type Ctx = { params: Promise<{ slug: string }> };

// Resolves a `§ allergy:<slug>` citation pill to the allergy it references,
// for the chat popover preview. Returns only the preview fields the popover
// renders plus the ids needed to build the detail-page link — the chat drawer
// is global, so the pill can't assume the current route's patientId.
export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params;
  const parsed = slugParamSchema.safeParse(slug);
  if (!parsed.success) {
    return apiError("validation_failed", "Invalid allergy slug");
  }

  const { patientId } = await getCurrentPatient();

  try {
    const allergy = await allergyQueries.bySlug(patientId, parsed.data);
    if (!allergy) {
      return apiError("not_found", "Allergy not found");
    }
    return Response.json({
      allergy: {
        id: allergy.id,
        patientId: allergy.patientId,
        substance: allergy.substance,
        category: allergy.category,
        severity: allergy.severity,
        status: allergy.status,
        reaction: allergy.reaction,
      },
    });
  } catch (err) {
    logger.error({
      op: "allergies.bySlug",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to resolve allergy");
  }
}
