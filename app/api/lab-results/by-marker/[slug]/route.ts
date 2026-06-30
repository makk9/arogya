import { z } from "zod";

import { labResultQueries } from "@/db/queries/lab";
import { apiError } from "@/lib/api/error";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";

// postgres-js (transitively via labResultQueries → @/db) requires Node.
export const runtime = "nodejs";

// A lab-result citation's marker slug is `slugify(markerNormalized ?? marker)`
// (serializers/lab-report.ts labResultSlug), e.g. `§ lab-result:creatinine`.
// The `lab-result:` prefix (and any trailing `:date`) is stripped by the parser
// upstream, leaving the bare marker slug here.
const slugParamSchema = z.string().regex(/^[a-z0-9-]+$/);

type Ctx = { params: Promise<{ slug: string }> };

// Resolves a `§ lab-result:<marker>` citation pill for the chat popover. Lab
// results have no detail page — the marker lives inside its §6.7 report — so
// the preview points at that report. Surfaces the measured value + flag so the
// popover answers "what was it" before the user clicks through.
export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params;
  const parsed = slugParamSchema.safeParse(slug);
  if (!parsed.success) {
    return apiError("validation_failed", "Invalid lab result slug");
  }

  const { patientId } = await getCurrentPatient();

  try {
    const found = await labResultQueries.byMarkerSlug(patientId, parsed.data);
    if (!found) {
      return apiError("not_found", "Lab result not found");
    }
    const { result, report } = found;
    return Response.json({
      result: {
        marker: result.markerNormalized ?? result.marker,
        value: result.value,
        valueText: result.valueText,
        unit: result.unit,
        flag: result.flag,
        resultDate: result.resultDate,
        reportId: report.id,
        reportPatientId: report.patientId,
        reportType: report.reportType,
        reportDate: report.reportDate,
      },
    });
  } catch (err) {
    logger.error({
      op: "labResults.byMarker",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to resolve lab result");
  }
}
