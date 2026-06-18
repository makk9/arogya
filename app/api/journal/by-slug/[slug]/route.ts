import { z } from "zod";

import { journalQueries } from "@/db/queries/journal";
import { apiError } from "@/lib/api/error";
import { getCurrentPatient } from "@/lib/auth";
import { journalFirstLine } from "@/lib/journal";
import { errorCode, logger } from "@/lib/logger";

// postgres-js (transitively via journalQueries → @/db) requires Node.
export const runtime = "nodejs";

// A journal slug is the ISO entry date (serializers/journal-entry.ts
// journalEntrySlug: `journal:2026-04-12`), matching the shared citation slug
// grammar. The `journal:` prefix is stripped by the parser upstream.
const slugParamSchema = z.string().regex(/^[a-z0-9-]+$/);

type Ctx = { params: Promise<{ slug: string }> };

// Resolves a `§ journal:<date>` citation pill for the chat popover preview. A
// title-less entry surfaces its first content line (§6.7:1535 "first-line
// preview"); the body text never leaves the slice already shown on the card.
export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params;
  const parsed = slugParamSchema.safeParse(slug);
  if (!parsed.success) {
    return apiError("validation_failed", "Invalid journal slug");
  }

  const { patientId } = await getCurrentPatient();

  try {
    const entry = await journalQueries.bySlug(patientId, parsed.data);
    if (!entry) {
      return apiError("not_found", "Journal entry not found");
    }
    return Response.json({
      entry: {
        id: entry.id,
        patientId: entry.patientId,
        entryDate: entry.entryDate,
        title: entry.title,
        mood: entry.mood,
        preview: journalFirstLine(entry.content),
      },
    });
  } catch (err) {
    logger.error({
      op: "journal.bySlug",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to resolve journal entry");
  }
}
