import { z } from "zod";

import { doctorQueries } from "@/db/queries/doctor";
import { visitQueries } from "@/db/queries/visit";
import { apiError } from "@/lib/api/error";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";

// postgres-js (transitively via visitQueries → @/db) requires Node.
export const runtime = "nodejs";

// A visit slug is the ISO visit date (serializers/visit.ts visitSlug:
// `visit:2026-04-30`), which fits the shared lowercase-alnum-hyphen citation
// slug grammar. The `visit:` prefix is stripped by the parser upstream.
const slugParamSchema = z.string().regex(/^[a-z0-9-]+$/);

type Ctx = { params: Promise<{ slug: string }> };

// Resolves a `§ visit:<date>` citation pill for the chat popover preview.
// The doctor is fetched alongside — "Visit · Dr Sharma · Apr 3 2026" is the
// §6.7 title shape and the preview mirrors it.
export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params;
  const parsed = slugParamSchema.safeParse(slug);
  if (!parsed.success) {
    return apiError("validation_failed", "Invalid visit slug");
  }

  const { patientId } = await getCurrentPatient();

  try {
    const visit = await visitQueries.bySlug(patientId, parsed.data);
    if (!visit) {
      return apiError("not_found", "Visit not found");
    }
    const doctor = await doctorQueries.getById(patientId, visit.doctorId);
    return Response.json({
      visit: {
        id: visit.id,
        patientId: visit.patientId,
        visitDate: visit.visitDate,
        visitType: visit.visitType,
        status: visit.status,
        chiefComplaint: visit.chiefComplaint,
        summary: visit.summary,
        doctor: doctor
          ? { name: doctor.name, specialty: doctor.specialty }
          : null,
      },
    });
  } catch (err) {
    logger.error({
      op: "visits.bySlug",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to resolve visit");
  }
}
