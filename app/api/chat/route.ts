import type { ModelMessage } from "ai";

import { runSynthesis } from "@/lib/agents/synthesis";
import { AgentError } from "@/lib/agents/_shared/errors";
import { apiError } from "@/lib/api/error";
import { getCurrentPatient } from "@/lib/auth";
import { chatRequestSchema } from "@/lib/schemas/api/chat";

// postgres-js (transitively imported via buildVaultContext → @/db) requires Node.
export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError("validation_failed", "Request body is not valid JSON");
  }

  const parsed = chatRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  // patientId is auth-derived, not client-supplied, per design.md 9.6:2755 +
  // CLAUDE.md tripwire ("All auth flows through getCurrentUser/Patient").
  const { patientId } = await getCurrentPatient();

  try {
    const result = await runSynthesis({
      patientId,
      // Cast: Zod validates role + presence of content; ModelMessage's strict
      // discriminated union is enforced by the AI SDK downstream.
      messages: parsed.data.messages as ModelMessage[],
      surfaceContext: parsed.data.surfaceContext,
    });
    return result.toUIMessageStreamResponse();
  } catch (err) {
    if (err instanceof AgentError) {
      const status = err.code === "rate_limit" ? 429 : 500;
      return apiError(
        "server_error",
        err.message,
        { agentCode: err.code, agentName: err.agentName },
        status,
      );
    }
    return apiError("server_error", "Unexpected error");
  }
}
