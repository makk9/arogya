import { insightQueries } from "@/db/queries/insight";
import { apiError } from "@/lib/api/error";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";

// postgres-js (transitively imported via insightQueries → @/db) requires Node.
export const runtime = "nodejs";

// GET the patient's insights. No POST: insights are AI-generated (§6.8:1565 "no
// primary action button"); generation lands in Phase E (§5.6), not via this
// route. Listing is also done directly in the feed RSC via insightQueries —
// this endpoint exists for parity and any future client-side refetch.
export async function GET(): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  try {
    const insights = await insightQueries.forPatient(patientId);
    return Response.json({ insights });
  } catch (err) {
    logger.error({
      op: "insights.list",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to read insights");
  }
}
