import { journalQueries } from "@/db/queries/journal";
import { apiError } from "@/lib/api/error";
import { parseJsonBody } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { scheduleInsightGeneration } from "@/lib/insights/schedule";
import { errorCode, logger } from "@/lib/logger";
import { createJournalSchema } from "@/lib/schemas/api/journal";

// postgres-js (transitively imported via journalQueries → @/db) requires Node.
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  try {
    const entries = await journalQueries.forPatient(patientId);
    return Response.json({ entries });
  } catch (err) {
    logger.error({ op: "journal.list", code: errorCode(err), ids: { patientId } });
    return apiError("server_error", "Failed to list journal entries");
  }
}

export async function POST(req: Request): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = createJournalSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const entry = await journalQueries.create({ ...parsed.data, patientId });
    scheduleInsightGeneration(patientId, { type: "journal", id: entry.id });
    return Response.json({ entry }, { status: 201 });
  } catch (err) {
    logger.error({ op: "journal.create", code: errorCode(err), ids: { patientId } });
    return apiError("server_error", "Failed to create journal entry");
  }
}
