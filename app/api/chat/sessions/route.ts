import { chatQueries } from "@/db/queries/chat";
import { apiError } from "@/lib/api/error";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";

// postgres-js (transitively imported via chatQueries → @/db) requires Node.
export const runtime = "nodejs";

// GET the patient's chat sessions for the CHATS history list (6.2:1189),
// most-recently-active first. patientId is auth-derived (9.6 tripwire).
export async function GET(): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  try {
    const sessions = await chatQueries.listSessions(patientId);
    return Response.json({ sessions });
  } catch (err) {
    logger.error({
      op: "chat.sessions.list",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to read chat sessions");
  }
}

// POST creates a new, untitled session and returns it. The full-screen surface
// calls this on the first message of a fresh `/chat` conversation (lazy
// creation — no empty orphan sessions from merely opening the surface). Title
// is filled in later by auto-titling (E6).
export async function POST(): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  try {
    const session = await chatQueries.createSession(patientId);
    return Response.json({ session }, { status: 201 });
  } catch (err) {
    logger.error({
      op: "chat.sessions.create",
      code: errorCode(err),
      ids: { patientId },
    });
    return apiError("server_error", "Failed to create chat session");
  }
}
