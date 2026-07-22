"use client";

/**
 * Patient-level chat drawer (design.md 6.2, adapted) — Phase C item 6.
 *
 * A single ephemeral conversation, hoisted to the patient layout so it persists
 * as the user navigates between entity pages (the layout doesn't remount on
 * child-route changes). Opened from any wiki surface's floating Ask AI button
 * via `useChatDrawer().openChat(surfaceContext)`; the page behind the slide-over
 * stays visible, so the user keeps the record in view while asking.
 *
 * Deviation from the 6.2 full-screen / 6.4:1354 "opens the full-screen chat"
 * spec, ratified with the user 2026-05-30 (drawer keeps context visible + the
 * thread alive across navigation). See decisions.md. The dedicated rail "Chat"
 * surface (6.2 three-column) still arrives with the rail in Phase D.
 *
 * `surfaceContext` rides each message's request body (sendMessage `body`), so
 * the surface tag tracks whichever page the user is on when they ask — one
 * thread, page-aware framing.
 *
 * Persistence + logging (2026-07-08): the drawer conversation is a real chat
 * session, not an ephemeral one — it lazily creates a `chat_sessions` row on the
 * first send, passes `sessionId` so `/api/chat` persists every turn + auto-titles
 * (identical to full-screen chat), and so drawer conversations show up in the
 * CHATS list. Typed input runs through the §5.5 router: `question` → synthesis,
 * `log` → quick-log → the §6.11 confirmation screen (the drawer closes and the
 * page navigates behind it; after commit the user returns to the page they were
 * on). One conversation model across both surfaces — not two fragmented ones.
 */

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useChat } from "@ai-sdk/react";
import { type UIMessage } from "ai";

import { AiMessage } from "@/components/ai-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface ChatDrawerContextValue {
  // Opens the drawer. The surface tag is published separately via `setSurface`
  // so it tracks the page the user is *currently* on, not just where the drawer
  // was first opened (the drawer stays open across navigation).
  openChat: () => void;
  setSurface: (surfaceContext?: string) => void;
}

const ChatDrawerContext = createContext<ChatDrawerContextValue | null>(null);

export function useChatDrawer(): ChatDrawerContextValue {
  const ctx = useContext(ChatDrawerContext);
  if (!ctx) {
    throw new Error("useChatDrawer must be used within <ChatDrawerProvider>");
  }
  return ctx;
}

// 6.2:1215 empty-conversation starters. "Generate a doctor brief" is omitted —
// the brief capability is Phase E (5.7), so offering it now would dead-end.
const STARTERS = [
  "Run a full health scan",
  "Investigate a concern",
  "Prep for an appointment",
] as const;

function textOf(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

// The router's three intents (§5.5), as returned by /api/chat/classify.
type ChatIntent = "question" | "log" | "ambiguous";

export function ChatDrawerProvider({
  patientId,
  children,
}: {
  patientId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // The surface the user is currently on. Pages publish it via `setSurface`
  // (the floating Ask AI button does this on mount + on route change), so each
  // sent message is tagged with the live current page — even after the drawer
  // was opened elsewhere and the user navigated with it pinned open.
  const surfaceContextRef = useRef<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // The drawer's persisted chat session (lazy-created on first send, like the
  // full-screen surface), plus the router/log in-flight flags.
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [routing, setRouting] = useState(false);
  const [logging, setLogging] = useState(false);
  // Original text of an `ambiguous`-classified input awaiting the log-vs-ask
  // choice (the §5.5 inline disambiguator). Null when none.
  const [pending, setPending] = useState<string | null>(null);
  // Guided-scribe nudge awaiting an answer or a skip (decisions.md 2026-07-17).
  // Same semantics as the full-screen surface: while open, typed input is the
  // ANSWER; navigation to the confirmation waits.
  const [nudge, setNudge] = useState<{
    question: string;
    extractionSessionId: string;
    sid: string | null;
    hadSession: boolean;
    hasEntities: boolean;
  } | null>(null);

  const { messages, sendMessage, setMessages, status, error } = useChat();

  const busy =
    status === "submitted" ||
    status === "streaming" ||
    creating ||
    routing ||
    logging;
  const isEmpty = messages.length === 0;

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status, open]);

  const setSurface = useCallback((surfaceContext?: string) => {
    surfaceContextRef.current = surfaceContext;
  }, []);
  const openChat = useCallback(() => setOpen(true), []);
  const contextValue = useMemo(
    () => ({ openChat, setSurface }),
    [openChat, setSurface],
  );

  // Lazy session creation on the first send (no empty orphan row from merely
  // opening the drawer). Returns the id, or null on failure (send still works,
  // just ephemeral).
  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    setCreating(true);
    try {
      const res = await fetch("/api/chat/sessions", { method: "POST" });
      if (!res.ok) return null;
      const body = (await res.json()) as { session: { id: string } };
      setSessionId(body.session.id);
      return body.session.id;
    } catch {
      return null;
    } finally {
      setCreating(false);
    }
  }, [sessionId]);

  // Question → synthesis (persisted when the session resolves). Canned starters
  // call this directly (they're definitionally questions).
  const runQuestion = useCallback(
    async (text: string) => {
      const sid = await ensureSession();
      sendMessage(
        { text },
        { body: { sessionId: sid ?? undefined, surfaceContext: surfaceContextRef.current } },
      );
    },
    [ensureSession, sendMessage],
  );

  // Navigate to the §6.11 confirmation. The drawer closes (§6.11 "NO floating
  // Ask AI" during the review task). `returnTo` targets the FULL-SCREEN chat
  // session, not the page behind the drawer: the drawer's local conversation
  // doesn't survive navigation, and post-commit the session holds the log-ack —
  // returning there lets the conversation continue naturally (§6.2:1203). Falls
  // back to the current page only when session creation failed.
  const navToConfirm = useCallback(
    (extractionSessionId: string, sid: string | null, hadSession: boolean) => {
      setOpen(false);
      const returnTo = sid
        ? `/patient/${patientId}/chat/${sid}`
        : (pathname ?? `/patient/${patientId}`);
      const chatParam = sid ? `&chatSessionId=${sid}` : "";
      // Session created solely for this log → a full discard downstream deletes
      // it rather than leaving a titled empty session behind.
      const newParam = sid && !hadSession ? "&newSession=1" : "";
      router.push(
        `/patient/${patientId}/extract/${extractionSessionId}?returnTo=${encodeURIComponent(returnTo)}${chatParam}${newParam}`,
      );
    },
    [router, pathname, patientId],
  );

  // Log → quick-log extraction → §6.11 confirmation, UNLESS the agent declined
  // (advisory shown inline) or asked a guided-scribe question (nudge shown; the
  // confirmation waits for the answer or an explicit skip). Mirrors the
  // full-screen surface's handling — the drawer must never race past the nudge.
  const runLog = useCallback(
    async (text: string, alreadyEchoed = false) => {
      if (!alreadyEchoed) {
        setMessages((prev) => [
          ...prev,
          { id: `local-${Date.now()}`, role: "user", parts: [{ type: "text", text }] },
        ]);
      }
      setLogging(true);
      // Captured before ensureSession: was this session created solely for this
      // log? Threads into `newSession=1` so a full discard cleans it up.
      const hadSession = sessionId !== null;
      const sid = await ensureSession();
      try {
        const res = await fetch("/api/chat/quick-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, sessionId: sid ?? undefined }),
        });
        if (!res.ok) return;
        const body = (await res.json()) as {
          extractionSessionId?: string;
          declined?: boolean;
          notice?: string;
          nudge?: boolean;
          question?: string;
          hasEntities?: boolean;
        };
        if (body.declined && body.notice) {
          setMessages((prev) => [
            ...prev,
            {
              id: `local-notice-${Date.now()}`,
              role: "assistant",
              parts: [{ type: "text", text: body.notice as string }],
            },
          ]);
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
          setMessages((prev) => [
            ...prev,
            {
              id: `local-nudge-${Date.now()}`,
              role: "assistant",
              parts: [{ type: "text", text: body.question as string }],
            },
          ]);
          return;
        }
        if (!body.extractionSessionId) return;
        navToConfirm(body.extractionSessionId, sid, hadSession);
      } catch {
        // Stay put on failure; the user can retry.
      } finally {
        setLogging(false);
      }
    },
    [ensureSession, setMessages, navToConfirm, sessionId],
  );

  // Answer to the nudge: re-extract original log + answer into the SAME session
  // (server reuse), then open the enriched confirmation. Nudge stays set until
  // the answer lands so a failed POST can be retried as an answer, not a fresh log.
  const answerNudge = useCallback(
    async (answer: string) => {
      const n = nudge;
      if (!n) return;
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}`, role: "user", parts: [{ type: "text", text: answer }] },
      ]);
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
        if (!res.ok) return;
        const body = (await res.json()) as { extractionSessionId?: string };
        if (body.extractionSessionId) {
          setNudge(null);
          navToConfirm(body.extractionSessionId, n.sid, n.hadSession);
        }
      } catch {
        // Nudge stays open; retry re-extracts via reuse.
      } finally {
        setLogging(false);
      }
    },
    [nudge, setMessages, navToConfirm],
  );

  // Skip the question: with entities extracted, confirm as-is; with nothing
  // extracted yet there's nothing to confirm — dismiss and stay in the drawer.
  const skipNudge = useCallback(() => {
    const n = nudge;
    if (!n) return;
    setNudge(null);
    if (n.hasEntities) navToConfirm(n.extractionSessionId, n.sid, n.hadSession);
  }, [nudge, navToConfirm]);

  // Typed input runs through the §5.5 router first. Echo immediately (before the
  // classify round-trip) so the message never trails the indicator; the echo is
  // pulled back for a question (sendMessage re-adds the real turn) or ambiguous
  // (the disambiguator card shows the text).
  const submit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setInput("");
      setPending(null);

      // While a nudge is open, the input is the ANSWER — skip classification.
      if (nudge) {
        void answerNudge(trimmed);
        return;
      }

      const echoId = `local-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: echoId, role: "user", parts: [{ type: "text", text: trimmed }] },
      ]);

      setRouting(true);
      let intent: ChatIntent = "question";
      try {
        const res = await fetch("/api/chat/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: trimmed }),
        });
        if (res.ok) intent = ((await res.json()) as { intent: ChatIntent }).intent;
      } catch {
        // Fall through as question.
      } finally {
        setRouting(false);
      }

      if (intent === "log") return void runLog(trimmed, true);
      setMessages((prev) => prev.filter((m) => m.id !== echoId));
      if (intent === "ambiguous") return setPending(trimmed);
      return void runQuestion(trimmed);
    },
    [busy, runLog, runQuestion, setMessages, nudge, answerNudge],
  );

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit(input);
  }

  // Leave the current conversation and start a fresh one. The old session stays
  // persisted (findable in the CHATS list); the next send lazily creates a new
  // one. No-op mid-stream so a new thread can't orphan an in-flight reply.
  function startNewConversation() {
    if (busy) return;
    setMessages([]);
    setSessionId(null);
    setPending(null);
    setNudge(null);
    setInput("");
  }

  return (
    <ChatDrawerContext.Provider value={contextValue}>
      {/*
        Push/squeeze instead of overlay: when the drawer is open we pad the page
        by the drawer's width (max-w-lg = 32rem) so the centered page content
        reflows into the space left of the drawer and stays fully visible. The
        padding transition matches the drawer's 300ms slide so they move in sync.
        Below sm the drawer is full-width (desktop-only v1), so no padding there.
      */}
      <div
        className={cn(
          "transition-[padding] duration-300 ease-in-out",
          open && "sm:pr-[32rem]",
        )}
      >
        {children}
      </div>

      {/*
        Non-modal: page scroll stays unlocked and the record behind the drawer
        remains visible + interactive (Base UI `modal={false}`), so the user can
        read/scroll the medication while chatting — the whole point of the drawer
        over a full page. We also keep it open on outside-press / focus-out so
        clicking the page for reference doesn't dismiss the conversation; only
        the Close button and Escape close it.
      */}
      <Sheet
        open={open}
        modal={false}
        onOpenChange={(next, details) => {
          if (
            !next &&
            (details.reason === "outside-press" || details.reason === "focus-out")
          ) {
            return;
          }
          setOpen(next);
        }}
      >
        <SheetContent side="right" overlay={false} className="sm:max-w-lg">
          <SheetHeader className="flex flex-row items-center justify-between border-b">
            <SheetTitle className="flex items-center gap-2">
              <span aria-hidden>✦</span> Ask AI
            </SheetTitle>
            <div className="flex items-center gap-4">
              {!isEmpty ? (
                <button
                  type="button"
                  onClick={startNewConversation}
                  disabled={busy}
                  className="text-sm text-stone-500 underline-offset-4 hover:text-stone-800 hover:underline disabled:opacity-40"
                >
                  New chat
                </button>
              ) : null}
              <SheetClose className="text-sm text-stone-500 underline-offset-4 hover:text-stone-800 hover:underline">
                Close
              </SheetClose>
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
            {isEmpty ? (
              <div className="flex flex-col gap-4">
                <p className="text-stone-600">
                  Ask anything about this record — I&apos;ll reason across everything on file.
                </p>
                <div className="flex flex-wrap gap-2">
                  {STARTERS.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      disabled={busy}
                      onClick={() => void runQuestion(starter)}
                      className="rounded-full border border-stone-300 px-3 py-1.5 text-sm text-stone-700 transition-colors hover:border-stone-400 hover:bg-stone-50 disabled:opacity-50"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) =>
                message.role === "user" ? (
                  <div key={message.id} className="flex justify-end">
                    {/* Periwinkle-tinted user bubble (the 6.2 accent slot).
                        Periwinkle locked 2026-05-31; supersedes the stone stand-in. */}
                    <div className="max-w-[80%] rounded-2xl bg-accent px-4 py-2.5 text-accent-foreground ring-1 ring-accent-foreground/15">
                      {textOf(message)}
                    </div>
                  </div>
                ) : (
                  <div
                    key={message.id}
                    className="[&_p]:mb-3 [&_p:last-child]:mb-0 [&_li]:ml-4 [&_ul]:my-2 [&_ul]:list-disc [&_ol]:my-2 [&_ol]:ml-4 [&_ol]:list-decimal"
                  >
                    <AiMessage markdown={textOf(message)} />
                  </div>
                ),
              )
            )}

            {status === "submitted" || routing || logging ? (
              <div className="flex gap-3 text-stone-500" aria-live="polite">
                <span
                  aria-hidden
                  className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600"
                >
                  ✦
                </span>
                <span className="pt-1">
                  {logging
                    ? "Logging that…"
                    : routing
                      ? "Reading that…"
                      : "•••"}
                </span>
              </div>
            ) : null}

            {/* Guided-scribe nudge — the agent asked for optional context (the
                question is the assistant turn above). Type the answer, or skip. */}
            {nudge ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={skipNudge}
                  className="rounded-full border border-stone-300 px-3 py-1.5 text-sm text-stone-700 transition-colors hover:border-stone-400 hover:bg-stone-50 disabled:opacity-50"
                >
                  {nudge.hasEntities ? "Just log it →" : "Never mind"}
                </button>
              </div>
            ) : null}

            {/* §5.5 inline disambiguator — when the router can't confidently tell
                a log from a question, ask one click rather than guess wrong. */}
            {pending ? (
              <div className="rounded-lg border border-border bg-muted p-4">
                <p className="text-sm text-foreground">
                  Did you want to log that, or ask about it?
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  &ldquo;{pending}&rdquo;
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      const text = pending;
                      setPending(null);
                      void runLog(text);
                    }}
                  >
                    Log it
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      const text = pending;
                      setPending(null);
                      void runQuestion(text);
                    }}
                  >
                    Ask about it
                  </Button>
                </div>
              </div>
            ) : null}

            {error ? (
              <p className="text-sm text-stone-500">
                Something interrupted that response. Try sending it again.
              </p>
            ) : null}

            <div ref={bottomRef} />
          </div>

          <form onSubmit={onSubmit} className="border-t p-4">
            <div className="flex items-end gap-2">
              <Textarea
                aria-label="Ask about this record"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submit(input);
                  }
                }}
                placeholder="Ask about this record…"
                rows={1}
                className="max-h-40 min-h-11 resize-none"
              />
              <Button type="submit" disabled={busy || input.trim().length === 0}>
                Send
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </ChatDrawerContext.Provider>
  );
}
