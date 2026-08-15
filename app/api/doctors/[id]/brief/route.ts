import type { ModelMessage } from "ai";

import { chatQueries } from "@/db/queries/chat";
import { doctorQueries } from "@/db/queries/doctor";
import { visitQueries } from "@/db/queries/visit";
import { apiError } from "@/lib/api/error";
import { validateUuidParam } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { briefModeOf } from "@/lib/chat/brief";
import { formatAbsoluteDate } from "@/lib/datetime";
import { displayDoctorName } from "@/lib/doctor-display";
import { errorCode, logger } from "@/lib/logger";
import { runSynthesis } from "@/lib/agents/synthesis";

// postgres-js + the Anthropic SDK require Node.
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/doctors/:id/brief — generate a doctor brief from the doctor
 * page, without a chat conversation (user-directed deviation from §5.7's
 * chat-only invocation, decisions.md 2026-08-15).
 *
 * Runs the synthesis agent headlessly in brief mode — delta when the doctor
 * has completed visits on record, handoff otherwise — then persists the
 * exchange into a new titled chat session, so the brief keeps §5.7's
 * persistence story (findable, reopenable, re-downloadable) and the existing
 * brief-pdf route serves the export. Responses:
 *   201 { sessionId }            — brief generated and persisted
 *   200 { declined, message }    — the agent declined (e.g. sparse data);
 *                                  nothing persisted, message shown to user
 */
export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "doctor id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    const doctor = await doctorQueries.getById(patientId, idCheck.id);
    if (!doctor) {
      return apiError("not_found", "Doctor not found");
    }

    const visits = await visitQueries.byDoctor(patientId, doctor.id);
    const completed = visits
      .filter((v) => v.status === "completed")
      .sort((a, b) => (a.visitDate < b.visitDate ? 1 : -1));
    const lastVisit = completed[0] ?? null;

    const name = displayDoctorName(doctor.name);
    const specialty = doctor.specialty ? ` (${doctor.specialty})` : "";
    const request = lastVisit
      ? `Generate a delta brief for ${name}${specialty}. Their last completed visit was ${formatAbsoluteDate(lastVisit.visitDate)}.`
      : `Generate a handoff brief for ${name}${specialty} — there are no completed visits with them on record. Infer the reason for referral from the record if it is clear; otherwise write "Not recorded".`;
    const userText = `${request} This request came from a one-click action, so do not ask clarifying questions — produce the brief now, writing "Not recorded" for anything unknown.`;
    const messages: ModelMessage[] = [{ role: "user", content: userText }];

    const result = await runSynthesis({ patientId, messages });
    const assistantText = await result.text;

    // User cancelled from the dialog mid-generation: the tokens are spent, but
    // don't leave an orphan session in their chat history for a brief they
    // abandoned. (204 is a formality — nobody is listening.)
    if (req.signal.aborted) {
      return new Response(null, { status: 204 });
    }

    if (briefModeOf(assistantText) === null) {
      // The agent declined (sparse data) or asked a question despite the
      // instruction — either way there is no brief to persist or export.
      return Response.json({ declined: true, message: assistantText });
    }

    const session = await chatQueries.createSession(patientId);
    await chatQueries.renameSession(
      patientId,
      session.id,
      `Doctor brief — ${name}`,
    );
    await chatQueries.addMessage(session.id, "user", userText);
    await chatQueries.addMessage(session.id, "assistant", assistantText);

    return Response.json({ sessionId: session.id }, { status: 201 });
  } catch (err) {
    logger.error({
      op: "doctors.brief",
      code: errorCode(err),
      ids: { patientId, doctorId: idCheck.id },
    });
    return apiError("server_error", "Failed to generate the brief");
  }
}
