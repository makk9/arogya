import { chatQueries } from "@/db/queries/chat";
import { apiError } from "@/lib/api/error";
import { parseJsonBody, validateUuidParam } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { renameChatSessionSchema } from "@/lib/schemas/api/chat";

// postgres-js (transitively imported via chatQueries → @/db) requires Node.
export const runtime = "nodejs";

type Ctx = { params: Promise<{ sessionId: string }> };

// GET a session with its full transcript — backs reopening a conversation
// (6.2:1189). Messages seed `useChat`'s initial state on the surface.
export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "sessionId", "session id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    const session = await chatQueries.getSession(patientId, idCheck.id);
    if (!session) {
      return apiError("not_found", "Chat session not found");
    }
    const messages = await chatQueries.getMessages(patientId, session.id);
    return Response.json({ session, messages });
  } catch (err) {
    logger.error({
      op: "chat.sessions.get",
      code: errorCode(err),
      ids: { patientId, sessionId: idCheck.id },
    });
    return apiError("server_error", "Failed to read chat session");
  }
}

// PATCH renames a session (… session menu, 6.2:1193). Title is the only mutable
// field; messages are append-only.
export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "sessionId", "session id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = renameChatSessionSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const session = await chatQueries.renameSession(
      patientId,
      idCheck.id,
      parsed.data.title,
    );
    if (!session) {
      return apiError("not_found", "Chat session not found");
    }
    return Response.json({ session });
  } catch (err) {
    logger.error({
      op: "chat.sessions.rename",
      code: errorCode(err),
      ids: { patientId, sessionId: idCheck.id },
    });
    return apiError("server_error", "Failed to rename chat session");
  }
}

// DELETE removes a session (… session menu, 6.2:1193); the FK cascade drops its
// messages with it.
export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "sessionId", "session id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    const deleted = await chatQueries.deleteSession(patientId, idCheck.id);
    if (!deleted) {
      return apiError("not_found", "Chat session not found");
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    logger.error({
      op: "chat.sessions.delete",
      code: errorCode(err),
      ids: { patientId, sessionId: idCheck.id },
    });
    return apiError("server_error", "Failed to delete chat session");
  }
}
