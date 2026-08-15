import { z } from "zod";

import { labResultQueries } from "@/db/queries/lab";
import { apiError } from "@/lib/api/error";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";

// postgres-js (transitively via labResultQueries → @/db) requires Node.
export const runtime = "nodejs";

// A lab-result citation slug is `<marker>[:date]` — `slugify(markerNormalized
// ?? marker)` plus the result date the serializer embeds
// (serializers/lab-report.ts labResultSlug, e.g. `§ lab-result:creatinine:2026-06-15`).
// The parser strips only the `lab-result:` type prefix; the compound slug
// arrives here whole. The date selects the exact cited measurement; a bare
// marker (older messages) resolves to the most recent match.
const slugParamSchema = z
  .string()
  .regex(/^([a-z0-9-]+)(?::(\d{4}-\d{2}-\d{2}))?$/)
  .transform((raw) => {
    const [marker, date] = raw.split(":");
    return { marker, date };
  });

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
    const found = await labResultQueries.byMarkerSlug(
      patientId,
      parsed.data.marker,
      parsed.data.date,
    );
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
