import { z } from "zod";

import { doctorQueries } from "@/db/queries/doctor";
import { labReportQueries, labResultQueries } from "@/db/queries/lab";
import { apiError } from "@/lib/api/error";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";

// postgres-js (transitively via labReportQueries → @/db) requires Node.
export const runtime = "nodejs";

// A lab-report slug is the ISO report date (serializers/lab-report.ts
// labReportSlug: `lab-report:2026-04-30`), matching the shared citation slug
// grammar. The `lab-report:` prefix is stripped by the parser upstream.
const slugParamSchema = z.string().regex(/^[a-z0-9-]+$/);

type Ctx = { params: Promise<{ slug: string }> };

// Resolves a `§ lab-report:<date>` citation pill for the chat popover preview.
// The flagged-marker count and ordering doctor are surfaced alongside — the
// §6.7 Lab detail leads with report type + flagged markers.
export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params;
  const parsed = slugParamSchema.safeParse(slug);
  if (!parsed.success) {
    return apiError("validation_failed", "Invalid lab report slug");
  }

  const { patientId } = await getCurrentPatient();

  try {
    const report = await labReportQueries.bySlug(patientId, parsed.data);
    if (!report) {
      return apiError("not_found", "Lab report not found");
    }
    const [results, doctor] = await Promise.all([
      labResultQueries.forReport(report.id),
      report.orderedBy
        ? doctorQueries.getById(patientId, report.orderedBy)
        : Promise.resolve(null),
    ]);
    const flaggedCount = results.filter(
      (r) => r.flag !== null && r.flag !== "normal",
    ).length;
    return Response.json({
      report: {
        id: report.id,
        patientId: report.patientId,
        reportDate: report.reportDate,
        reportType: report.reportType,
        labName: report.labName,
        markerCount: results.length,
        flaggedCount,
        orderingDoctor: doctor
          ? { name: doctor.name, specialty: doctor.specialty }
          : null,
      },
    });
  } catch (err) {
    logger.error({
      op: "labReports.bySlug",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to resolve lab report");
  }
}
