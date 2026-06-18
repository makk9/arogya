import { z } from "zod";

import { conditionQueries } from "@/db/queries/condition";
import { symptomEpisodeQueries, symptomTypeQueries } from "@/db/queries/symptom";
import { apiError } from "@/lib/api/error";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";

// postgres-js (transitively via the queries → @/db) requires Node.
export const runtime = "nodejs";

// A symptom-type slug is slugify(name) (serializers/symptom.ts symptomTypeSlug:
// `symptom:dizziness`), which fits the shared lowercase-alnum-hyphen citation
// grammar. The `symptom:` prefix is stripped by the parser upstream.
const slugParamSchema = z.string().regex(/^[a-z0-9-]+$/);

type Ctx = { params: Promise<{ slug: string }> };

// Resolves a `§ symptom:<slug>` citation pill for the chat popover preview.
// Episode count + linked condition are fetched alongside — they're the
// preview's body lines.
export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params;
  const parsed = slugParamSchema.safeParse(slug);
  if (!parsed.success) {
    return apiError("validation_failed", "Invalid symptom slug");
  }

  const { patientId } = await getCurrentPatient();

  try {
    const type = await symptomTypeQueries.bySlug(patientId, parsed.data);
    if (!type) {
      return apiError("not_found", "Symptom type not found");
    }
    const [episodes, condition] = await Promise.all([
      symptomEpisodeQueries.forType(patientId, type.id),
      type.linkedCondition
        ? conditionQueries.getById(patientId, type.linkedCondition)
        : Promise.resolve(null),
    ]);
    return Response.json({
      symptom: {
        id: type.id,
        patientId: type.patientId,
        name: type.name,
        status: type.status,
        bodyArea: type.bodyArea,
        episodeCount: episodes.length,
        linkedConditionName: condition?.name ?? null,
      },
    });
  } catch (err) {
    logger.error({
      op: "symptomTypes.bySlug",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to resolve symptom type");
  }
}
