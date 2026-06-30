import { runRouter } from "@/lib/agents/router";
import { AgentError } from "@/lib/agents/_shared/errors";
import { apiError } from "@/lib/api/error";
import { parseJsonBody } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { classifyRequestSchema } from "@/lib/schemas/api/chat";

// Anthropic SDK + auth helper want Node.
export const runtime = "nodejs";

/**
 * POST /api/chat/classify — runs the Haiku quick-log router (§5.5) on a single
 * chat input and returns its intent. The client branches on the result; the
 * router itself is stateless and sees no vault (§5.5:827), so there's no PHI
 * here beyond the user's own typed text. On router failure we fall back to
 * `question` — §5.5's bias (wrong-route-to-chat is the cheap failure).
 */
export async function POST(req: Request): Promise<Response> {
  // Auth-gates the endpoint (no patient data is read, but only an authed user
  // should reach the router).
  await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = classifyRequestSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const result = await runRouter({ input: parsed.data.input });
    return Response.json({
      intent: result.intent,
      confidence: result.confidence,
    });
  } catch (err) {
    // Degrade to question rather than blocking input on a classifier hiccup.
    logger.warn({
      op: "chat.classify",
      code: err instanceof AgentError ? `AgentError:${err.code}` : errorCode(err),
    });
    return Response.json({ intent: "question", confidence: "low" });
  }
}
