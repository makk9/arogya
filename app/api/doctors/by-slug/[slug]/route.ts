import { z } from "zod";

import { doctorQueries } from "@/db/queries/doctor";
import { apiError } from "@/lib/api/error";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";

// postgres-js (transitively via doctorQueries → @/db) requires Node.
export const runtime = "nodejs";

// Citation slugs are lowercase alnum + hyphen (`slugify()` output in
// serializers/format.ts). The `doctor:` prefix is stripped by the parser
// before it reaches the pill, so the path param is the bare slug.
const slugParamSchema = z.string().regex(/^[a-z0-9-]+$/);

type Ctx = { params: Promise<{ slug: string }> };

// Resolves a `§ doctor:<slug>` citation pill to the doctor it references, for
// the chat popover preview. Returns only the preview fields the popover renders
// plus the ids needed to build the detail-page link.
export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params;
  const parsed = slugParamSchema.safeParse(slug);
  if (!parsed.success) {
    return apiError("validation_failed", "Invalid doctor slug");
  }

  const { patientId } = await getCurrentPatient();

  try {
    const doctor = await doctorQueries.bySlug(patientId, parsed.data);
    if (!doctor) {
      return apiError("not_found", "Doctor not found");
    }
    return Response.json({
      doctor: {
        id: doctor.id,
        patientId: doctor.patientId,
        name: doctor.name,
        specialty: doctor.specialty,
        clinic: doctor.clinic,
      },
    });
  } catch (err) {
    logger.error({
      op: "doctors.bySlug",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to resolve doctor");
  }
}
