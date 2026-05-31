import { z } from "zod";

import { medicationQueries } from "@/db/queries/medication";
import { apiError } from "@/lib/api/error";
import { getCurrentPatient } from "@/lib/auth";

// postgres-js (transitively via medicationQueries → @/db) requires Node.
export const runtime = "nodejs";

// Citation slugs are lowercase alnum + hyphen (`slugify()` output in
// serializers/format.ts). The `med:` prefix is stripped by the parser before it
// reaches the pill, so the path param is the bare slug (e.g. "amlodipine").
const slugParamSchema = z.string().regex(/^[a-z0-9-]+$/);

type Ctx = { params: Promise<{ slug: string }> };

// Resolves a `§ med:<slug>` citation pill to the medication it references, for
// the chat popover preview (Phase C item 7). Returns only the preview fields the
// popover renders plus the ids needed to build the detail-page link — the chat
// drawer is global, so the pill can't assume the current route's patientId.
export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params;
  const parsed = slugParamSchema.safeParse(slug);
  if (!parsed.success) {
    return apiError("validation_failed", "Invalid medication slug");
  }

  const { patientId } = await getCurrentPatient();

  try {
    const medication = await medicationQueries.bySlug(patientId, parsed.data);
    if (!medication) {
      return apiError("not_found", "Medication not found");
    }
    return Response.json({
      medication: {
        id: medication.id,
        patientId: medication.patientId,
        name: medication.name,
        currentDose: medication.currentDose,
        currentFrequency: medication.currentFrequency,
        status: medication.status,
      },
    });
  } catch {
    return apiError("server_error", "Failed to resolve medication");
  }
}
