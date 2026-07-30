import { after } from "next/server";
import type { ModelMessage } from "ai";

import type { InsightEntityRef, OnboardingPhase } from "@/db/schema";
import { onboardingSessionQueries } from "@/db/queries";
import { runOnboardingTurn } from "@/lib/agents/onboarding";
import { AgentError } from "@/lib/agents/_shared/errors";
import {
  onboardingEntityEmissionSchema,
  onboardingPhaseEmissionSchema,
  onboardingPhases,
} from "@/lib/agents/_shared/schemas";
import { apiError } from "@/lib/api/error";
import { parseJsonBody } from "@/lib/api/route-helpers";
import { getCurrentPatient, getCurrentUser } from "@/lib/auth";
import { todayInTimezone } from "@/lib/datetime";
import { maybeRunInsightGeneration } from "@/lib/insights/generate";
import {
  applyOnboardingEmission,
  type OnboardingWriteContext,
} from "@/lib/onboarding/commit";
import { loadOnboardingSnapshot } from "@/lib/onboarding/snapshot";
import { encodeWireEvent, FenceParser } from "@/lib/onboarding/stream";
import { errorCode, logger } from "@/lib/logger";
import { onboardingTurnRequestSchema } from "@/lib/schemas/api/onboarding";

// postgres-js (via the query layer) requires Node.
export const runtime = "nodejs";

// Emission types that count as clinical signal for the completion-time insight
// trigger (doctor rows are care-team bookkeeping; patient/lifestyle/family
// history are profile, not events — mirrors the extract-commit choice).
const REF_TYPE_BY_EMISSION: Record<string, string> = {
  medication: "med",
  condition: "condition",
  allergy: "allergy",
  lab_report: "lab-report",
  vital_reading: "vital",
  visit: "visit",
  symptom_episode: "symptom-episode",
  journal_entry: "journal",
};

// The synthetic user turn behind the agent's opening message. Never persisted —
// the visible transcript starts with the agent greeting the user.
const OPENING_TURN =
  "[The user just opened the onboarding interview. Greet them and begin phase 1.]";

/** GET /api/onboarding — session state + panel snapshot (client refetch). */
export async function GET(): Promise<Response> {
  const { patientId } = await getCurrentPatient();
  const [session, snapshot] = await Promise.all([
    onboardingSessionQueries.getForPatient(patientId),
    loadOnboardingSnapshot(patientId),
  ]);
  if (!snapshot) return apiError("not_found", "Patient not found");
  return Response.json({
    session: session
      ? {
          status: session.status,
          currentPhase: session.currentPhase,
        }
      : null,
    snapshot,
  });
}

/**
 * POST /api/onboarding — one interview turn (E4, §5.8/§6.3). Streams ndjson:
 * `text` events (the agent's visible reply), `entity` events (live-transparency
 * writes as they land — §5.8:1023, the sanctioned no-confirmation-gate path),
 * `phase` events, then `done`. The turn persists to the singleton
 * onboarding_sessions transcript before `done` so a reload resumes cleanly.
 */
export async function POST(req: Request): Promise<Response> {
  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;
  const parsed = onboardingTurnRequestSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError("validation_failed", "Invalid request body", parsed.error.flatten());
  }

  const { patientId, timezone } = await getCurrentPatient();
  const { userId } = await getCurrentUser();

  const session = await onboardingSessionQueries.getOrCreate(patientId);
  const userText = parsed.data.message?.trim() ?? "";

  const history: ModelMessage[] = session.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const messages: ModelMessage[] = [
    ...history,
    { role: "user", content: userText.length > 0 ? userText : OPENING_TURN },
  ];

  const today = todayInTimezone(timezone);
  const writeCtx: OnboardingWriteContext = {
    patientId,
    userId,
    timezone,
    today,
    nowIso: new Date().toISOString(),
  };

  // §5.8:1043 — a return after ~7 days of inactivity gets an explicit
  // resume-or-skip offer. Only meaningful once a transcript exists.
  const daysSinceLastTurn =
    session.messages.length > 0
      ? Math.floor((Date.now() - session.updatedAt.getTime()) / 86_400_000)
      : 0;

  let result: Awaited<ReturnType<typeof runOnboardingTurn>>;
  try {
    result = await runOnboardingTurn({
      patientId,
      messages,
      currentPhase: session.currentPhase,
      today,
      resumeAfterDays: daysSinceLastTurn,
    });
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

  const { readable, writable } = new TransformStream<Uint8Array>();
  const encoder = new TextEncoder();

  // The interview finishing is the "significant entity creation" moment — the
  // vault was just built — so completion fires ONE debounced insight-gen run
  // (§5.6/§9.3; the generator itself decides whether anything is worth
  // surfacing — empty output is the normal outcome when nothing changed).
  // Two hard-won constraints (decisions.md 2026-07-29):
  //  - `after()` must be registered HERE, in the handler's request scope — an
  //    `after()` call from inside the detached pump is silently dropped.
  //  - The completing turn usually commits nothing itself ("we're done"), so
  //    a this-turn ref falls back to the vault's most recent clinical entity;
  //    only a truly empty vault skips the run (nothing to analyze).
  let resolveCompletion!: (outcome: {
    complete: boolean;
    ref: InsightEntityRef | null;
  }) => void;
  const completionOutcome = new Promise<{
    complete: boolean;
    ref: InsightEntityRef | null;
  }>((resolve) => {
    resolveCompletion = resolve;
  });
  after(async () => {
    const { complete, ref } = await completionOutcome;
    if (!complete) return;
    try {
      const trigger =
        ref ?? (await onboardingSessionQueries.latestClinicalRef(patientId));
      if (!trigger) return;
      await maybeRunInsightGeneration({ patientId, trigger });
    } catch (err) {
      logger.error({
        op: "onboarding.insight_trigger",
        code: errorCode(err),
        ids: { patientId },
      });
    }
  });

  const pump = async (): Promise<void> => {
    const writer = writable.getWriter();
    const write = (event: Parameters<typeof encodeWireEvent>[0]) =>
      writer.write(encoder.encode(encodeWireEvent(event)));

    const parser = new FenceParser();
    let visibleText = "";
    let latestPhase: OnboardingPhase | undefined;
    let lastClinicalRef: { type: string; id: string } | null = null;

    const handleFence = async (tag: "entity" | "phase", fenceBody: string) => {
      let json: unknown;
      try {
        json = JSON.parse(fenceBody);
      } catch {
        logger.warn({ op: "onboarding.fence_parse", ids: { patientId } });
        return;
      }
      if (tag === "phase") {
        const phase = onboardingPhaseEmissionSchema.safeParse(json);
        if (!phase.success) {
          logger.warn({ op: "onboarding.phase_invalid", ids: { patientId } });
          return;
        }
        latestPhase = phase.data.phase;
        const step = Math.min(
          onboardingPhases.indexOf(latestPhase) + 1,
          onboardingPhases.length - 1,
        );
        await write({ t: "phase", phase: latestPhase, step });
        return;
      }
      const emission = onboardingEntityEmissionSchema.safeParse(json);
      if (!emission.success) {
        logger.warn({ op: "onboarding.emission_invalid", ids: { patientId } });
        return;
      }
      try {
        const written = await applyOnboardingEmission(writeCtx, emission.data);
        if (written.ok && written.entityId) {
          const refType = REF_TYPE_BY_EMISSION[written.type];
          if (refType) {
            lastClinicalRef = { type: refType, id: written.entityId };
          }
        }
        if (!written.ok) {
          logger.warn({
            op: "onboarding.emission_refused",
            code: written.type,
            ids: { patientId },
          });
        }
        await write({
          t: "entity",
          ok: written.ok,
          type: written.type,
          id: written.entityId,
          label: written.label,
        });
      } catch (err) {
        logger.error({
          op: "onboarding.emission_write",
          code: errorCode(err),
          ids: { patientId },
        });
        await write({ t: "entity", ok: false, type: emission.data.type });
      }
    };

    try {
      for await (const chunk of result.textStream) {
        for (const token of parser.push(chunk)) {
          if (token.kind === "text") {
            visibleText += token.text;
            await write({ t: "text", d: token.text });
          } else {
            await handleFence(token.tag, token.body);
          }
        }
      }
      const { tokens, droppedFence } = parser.flush();
      if (droppedFence) {
        logger.warn({ op: "onboarding.fence_unterminated", ids: { patientId } });
      }
      for (const token of tokens) {
        if (token.kind === "text") {
          visibleText += token.text;
          await write({ t: "text", d: token.text });
        }
      }

      // Persist BEFORE done so the client can rely on a reload resuming this
      // turn. An empty generation persists nothing (mirrors the chat route).
      if (visibleText.trim().length > 0) {
        await onboardingSessionQueries.appendTurn(patientId, {
          userText: userText.length > 0 ? userText : undefined,
          assistantText: visibleText,
          phase: latestPhase,
        });
      }

      await write({ t: "done" });
    } catch (err) {
      logger.error({
        op: "onboarding.turn_stream",
        code: errorCode(err),
        ids: { patientId },
      });
      // Keep what the user already saw: committed entities and partial reply
      // stay coherent on reload.
      if (visibleText.trim().length > 0) {
        try {
          await onboardingSessionQueries.appendTurn(patientId, {
            userText: userText.length > 0 ? userText : undefined,
            assistantText: visibleText,
            phase: latestPhase,
          });
        } catch {
          // Already logging the stream failure; a persist failure here has no
          // separate remedy.
        }
      }
      try {
        await write({
          t: "error",
          message: "Something interrupted that reply. Send your message again.",
        });
      } catch {
        // Client already disconnected.
      }
    } finally {
      // Always resolves — a turn that errored or never reached `complete`
      // makes the after() callback no-op.
      resolveCompletion({
        complete: latestPhase === "complete",
        ref: lastClinicalRef,
      });
      try {
        await writer.close();
      } catch {
        // Stream already errored/closed.
      }
    }
  };
  void pump();

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
