"use client";

/**
 * Shared quick-log client flow (§5.5 router → §5.4 extraction → §6.11
 * confirmation) for BOTH conversational surfaces — the full-screen chat pane
 * and the Ask-AI drawer. Extracted after the drawer's hand-rolled copy drifted
 * and raced past the guided-scribe nudge (decisions.md 2026-07-22): one
 * implementation, two thin consumers.
 *
 * The hook owns: classify dispatch, the quick-log POST and its three outcomes
 * (confirm / nudge / declined), the enrichment-nudge answer/skip lifecycle,
 * the §5.5 disambiguator's pending state, failure retry, and navigation to the
 * confirmation (returnTo always targets the persisted chat session so the
 * conversation continues after commit, §6.2:1203).
 *
 * The surface owns: its useChat instance (messages go through the injected
 * `setMessages`), session creation (`ensureSession` — lazy-create semantics
 * differ per surface), the question path (`runQuestion` — different sendMessage
 * bodies), input/busy state, and all rendering.
 */

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { UIMessage } from "ai";

// The router's three intents (§5.5), as returned by /api/chat/classify.
type ChatIntent = "question" | "log" | "ambiguous";

export interface QuickLogNudge {
  question: string;
  extractionSessionId: string;
  sid: string | null;
  hadSession: boolean;
  // False when the agent asked but extracted nothing yet — skipping then has
  // nothing to confirm, so the skip affordance dismisses in-chat rather than
  // opening the (empty → failure) confirmation screen.
  hasEntities: boolean;
}

interface UseQuickLogParams {
  patientId: string;
  // The surface's current persisted session id (null = draft). Captured before
  // ensureSession so a session created solely for one log can be cleaned up on
  // a full discard downstream (`newSession=1`).
  sessionId: string | null;
  ensureSession: () => Promise<string | null>;
  // The surface's useChat setMessages — echoes and advisory turns land in its
  // own message list.
  setMessages: (
    messages: UIMessage[] | ((prev: UIMessage[]) => UIMessage[]),
  ) => void;
  // The surface's question path (router `question` branch + disambiguator's
  // "Ask about it").
  runQuestion: (text: string) => void | Promise<void>;
  // Called after a declined/nudge turn persisted server-side, so the surface
  // can refetch anything derived (e.g. the CHATS list title). Optional.
  onPersisted?: () => void;
  // Runs just before navigating to the confirmation (the drawer closes itself).
  beforeNavigate?: () => void;
  // returnTo when no session exists (creation failed): the full-screen pane
  // falls back to its chat index, the drawer to the page it's floating over.
  fallbackReturnTo: string;
}

export function useQuickLog({
  patientId,
  sessionId,
  ensureSession,
  setMessages,
  runQuestion,
  onPersisted,
  beforeNavigate,
  fallbackReturnTo,
}: UseQuickLogParams) {
  const router = useRouter();
  // True while the classify call is in flight.
  const [routing, setRouting] = useState(false);
  // True while a confirmed `log` is being extracted (quick-log POST).
  const [logging, setLogging] = useState(false);
  // Original text of an `ambiguous`-classified input awaiting the log-vs-ask
  // choice (the §5.5 inline disambiguator). Null when none.
  const [pending, setPending] = useState<string | null>(null);
  // Set to the log text when a quick-log request fails — surfaces an inline
  // error + retry instead of silently stranding the echoed user turn.
  const [logError, setLogError] = useState<string | null>(null);
  // Guided-scribe nudge awaiting an answer or a skip: while open, typed input
  // is the ANSWER and navigation to the confirmation waits.
  const [nudge, setNudge] = useState<QuickLogNudge | null>(null);

  const echoUser = useCallback(
    (text: string, id?: string) => {
      setMessages((prev) => [
        ...prev,
        {
          id: id ?? `local-${Date.now()}`,
          role: "user",
          parts: [{ type: "text", text }],
        },
      ]);
    },
    [setMessages],
  );

  const echoAssistant = useCallback(
    (text: string, idPrefix: string) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `${idPrefix}-${Date.now()}`,
          role: "assistant",
          parts: [{ type: "text", text }],
        },
      ]);
    },
    [setMessages],
  );

  // Navigate to the §6.11 confirmation, preserving the chat origin. returnTo
  // targets the persisted session (where the post-commit log-ack lands) so the
  // conversation continues naturally after commit — never a page the
  // conversation can't follow the user back to.
  const navToConfirm = useCallback(
    (extractionSessionId: string, sid: string | null, hadSession: boolean) => {
      beforeNavigate?.();
      const returnTo = sid
        ? `/patient/${patientId}/chat/${sid}`
        : fallbackReturnTo;
      const chatParam = sid ? `&chatSessionId=${sid}` : "";
      // Session created solely for this log → a full discard downstream
      // deletes it rather than leaving a titled empty session behind.
      const newParam = sid && !hadSession ? "&newSession=1" : "";
      router.push(
        `/patient/${patientId}/extract/${extractionSessionId}?returnTo=${encodeURIComponent(returnTo)}${chatParam}${newParam}`,
      );
    },
    [router, patientId, fallbackReturnTo, beforeNavigate],
  );

  // Log → quick-log extraction → confirmation, UNLESS the agent declined (its
  // advisory shows inline) or asked a guided-scribe question (the nudge shows;
  // the confirmation waits for an answer or an explicit skip).
  const runLog = useCallback(
    async (text: string, alreadyEchoed = false) => {
      if (!alreadyEchoed) echoUser(text);
      setLogError(null);
      setLogging(true);
      const hadSession = sessionId !== null;
      const sid = await ensureSession();
      try {
        const res = await fetch("/api/chat/quick-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, sessionId: sid ?? undefined }),
        });
        if (!res.ok) {
          setLogError(text);
          return;
        }
        const body = (await res.json()) as {
          extractionSessionId?: string;
          declined?: boolean;
          notice?: string;
          nudge?: boolean;
          question?: string;
          hasEntities?: boolean;
        };
        if (body.declined && body.notice) {
          echoAssistant(body.notice, "local-notice");
          onPersisted?.();
          return;
        }
        if (body.nudge && body.question && body.extractionSessionId) {
          setNudge({
            question: body.question,
            extractionSessionId: body.extractionSessionId,
            sid,
            hadSession,
            hasEntities: body.hasEntities ?? true,
          });
          echoAssistant(body.question, "local-nudge");
          onPersisted?.();
          return;
        }
        if (!body.extractionSessionId) return;
        navToConfirm(body.extractionSessionId, sid, hadSession);
      } catch {
        setLogError(text);
      } finally {
        setLogging(false);
      }
    },
    [echoUser, echoAssistant, ensureSession, sessionId, onPersisted, navToConfirm],
  );

  // Answer to the nudge: re-extract original log + answer into the SAME
  // session (server reuse), then open the enriched confirmation. `nudge` stays
  // set until the answer lands — a failed POST retries as an answer (via
  // reuse), not as a fresh log through the classifier.
  const answerNudge = useCallback(
    async (answer: string, alreadyEchoed = false) => {
      const n = nudge;
      if (!n) return;
      if (!alreadyEchoed) echoUser(answer);
      setLogError(null);
      setLogging(true);
      try {
        const res = await fetch("/api/chat/quick-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: answer,
            sessionId: n.sid ?? undefined,
            reuseSessionId: n.extractionSessionId,
          }),
        });
        if (!res.ok) {
          setLogError(answer);
          return;
        }
        const body = (await res.json()) as { extractionSessionId?: string };
        if (body.extractionSessionId) {
          setNudge(null);
          navToConfirm(body.extractionSessionId, n.sid, n.hadSession);
        }
      } catch {
        setLogError(answer);
      } finally {
        setLogging(false);
      }
    },
    [nudge, echoUser, navToConfirm],
  );

  // Skip the question: with entities extracted, confirm as-is; with nothing
  // extracted yet there's nothing to confirm — dismiss and stay in the chat.
  const skipNudge = useCallback(() => {
    const n = nudge;
    if (!n) return;
    setNudge(null);
    if (n.hasEntities) navToConfirm(n.extractionSessionId, n.sid, n.hadSession);
  }, [nudge, navToConfirm]);

  // Typed input runs through the router first (§5.5 — every chat input).
  // question → synthesis, log → quick-log, ambiguous → inline disambiguator.
  // While a nudge is open the input is the ANSWER — classification is skipped.
  // A classifier failure biases to question (the cheap wrong-route per §5.5).
  const route = useCallback(
    async (text: string) => {
      if (nudge) return void answerNudge(text);
      setPending(null);
      setLogError(null);

      // Paint the user's message immediately — before the classify round-trip —
      // so it never trails the "Reading that…" indicator. Pulled back if the
      // input turns out to be a question (sendMessage re-adds the real turn) or
      // ambiguous (the disambiguator card shows the text instead).
      const echoId = `local-${Date.now()}`;
      echoUser(text, echoId);

      setRouting(true);
      let intent: ChatIntent = "question";
      try {
        const res = await fetch("/api/chat/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: text }),
        });
        if (res.ok) {
          intent = ((await res.json()) as { intent: ChatIntent }).intent;
        }
      } catch {
        // Fall through as question.
      } finally {
        setRouting(false);
      }

      if (intent === "log") return void runLog(text, true);
      setMessages((prev) => prev.filter((m) => m.id !== echoId));
      if (intent === "ambiguous") return setPending(text);
      return void runQuestion(text);
    },
    [nudge, answerNudge, echoUser, setMessages, runLog, runQuestion],
  );

  // The §5.5 disambiguator's two buttons.
  const resolvePendingAsLog = useCallback(() => {
    const text = pending;
    if (!text) return;
    setPending(null);
    void runLog(text);
  }, [pending, runLog]);

  const resolvePendingAsQuestion = useCallback(() => {
    const text = pending;
    if (!text) return;
    setPending(null);
    void runQuestion(text);
  }, [pending, runQuestion]);

  // Retry after a failed quick-log POST. A retry while a nudge is open is the
  // answer re-submitted (reuse); otherwise a plain log retry. The original
  // echo is still on screen, so never re-echo.
  const retryLog = useCallback(() => {
    const text = logError;
    if (!text) return;
    setLogError(null);
    if (nudge) void answerNudge(text, true);
    else void runLog(text, true);
  }, [logError, nudge, answerNudge, runLog]);

  // A canned question (starter / follow-up / shortcut chip) bypasses the
  // router, so it must also close an open nudge — otherwise the NEXT typed
  // question would be swallowed as the nudge's answer.
  const ask = useCallback(
    (text: string) => {
      setNudge(null);
      setPending(null);
      setLogError(null);
      void runQuestion(text);
    },
    [runQuestion],
  );

  // Leaving the conversation (e.g. the drawer's "New chat"): drop in-flight
  // quick-log affordances tied to the old session.
  const reset = useCallback(() => {
    setPending(null);
    setNudge(null);
    setLogError(null);
  }, []);

  return {
    routing,
    logging,
    pending,
    nudge,
    logError,
    route,
    ask,
    runLog,
    skipNudge,
    resolvePendingAsLog,
    resolvePendingAsQuestion,
    retryLog,
    reset,
  };
}
