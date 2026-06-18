import { z } from "zod";

import { symptomEpisodeQueries, symptomTypeQueries } from "@/db/queries/symptom";
import { apiError } from "@/lib/api/error";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";

// postgres-js (transitively via the queries → @/db) requires Node.
export const runtime = "nodejs";

// An episode slug is the ISO start date (serializers/symptom.ts
// symptomEpisodeSlug: `symptom-episode:2026-04-28`), fitting the shared
// lowercase-alnum-hyphen grammar. The `symptom-episode:` prefix is stripped by
// the parser upstream.
const slugParamSchema = z.string().regex(/^[a-z0-9-]+$/);

type Ctx = { params: Promise<{ slug: string }> };

// Resolves a `§ symptom-episode:<date>` citation pill. The parent type's name
// shapes the preview title ("Dizziness · Apr 28 2026").
export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params;
  const parsed = slugParamSchema.safeParse(slug);
  if (!parsed.success) {
    return apiError("validation_failed", "Invalid symptom episode slug");
  }

  const { patientId } = await getCurrentPatient();

  try {
    const episode = await symptomEpisodeQueries.bySlug(patientId, parsed.data);
    if (!episode) {
      return apiError("not_found", "Symptom episode not found");
    }
    const type = await symptomTypeQueries.getById(patientId, episode.symptomTypeId);
    return Response.json({
      episode: {
        id: episode.id,
        patientId: episode.patientId,
        startedAt: episode.startedAt.toISOString(),
        severity: episode.severity,
        description: episode.description,
        symptomTypeName: type?.name ?? null,
      },
    });
  } catch (err) {
    logger.error({
      op: "symptomEpisodes.bySlug",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to resolve symptom episode");
  }
}
