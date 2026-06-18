import { z } from "zod";

import { doctorQueries } from "@/db/queries/doctor";
import { reportQueries } from "@/db/queries/report";
import { apiError } from "@/lib/api/error";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";

// postgres-js (transitively via reportQueries → @/db) requires Node.
export const runtime = "nodejs";

// A report slug is the ISO report date (serializers/report.ts reportSlug:
// `report:2026-04-12`), which fits the shared lowercase-alnum-hyphen citation
// slug grammar. The `report:` prefix is stripped by the parser upstream.
const slugParamSchema = z.string().regex(/^[a-z0-9-]+$/);

type Ctx = { params: Promise<{ slug: string }> };

// Resolves a `§ report:<date>` citation pill for the chat popover preview. The
// linked doctor (author/source) and the count of extracted outcomes are
// surfaced alongside — the §6.7 Report detail leads with the title, type, and
// what came out of the document.
export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params;
  const parsed = slugParamSchema.safeParse(slug);
  if (!parsed.success) {
    return apiError("validation_failed", "Invalid report slug");
  }

  const { patientId } = await getCurrentPatient();

  try {
    const report = await reportQueries.bySlug(patientId, parsed.data);
    if (!report) {
      return apiError("not_found", "Report not found");
    }
    const [doctor, outcomes] = await Promise.all([
      report.linkedDoctorId
        ? doctorQueries.getById(patientId, report.linkedDoctorId)
        : Promise.resolve(null),
      reportQueries.outcomesForReport(patientId, report.id),
    ]);
    return Response.json({
      report: {
        id: report.id,
        patientId: report.patientId,
        title: report.title,
        reportDate: report.reportDate,
        reportType: report.reportType,
        outcomeCount: outcomes.medications.length + outcomes.conditions.length,
        linkedDoctor: doctor
          ? { name: doctor.name, specialty: doctor.specialty }
          : null,
      },
    });
  } catch (err) {
    logger.error({
      op: "reports.bySlug",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to resolve report");
  }
}
