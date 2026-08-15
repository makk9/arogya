"use client";

/**
 * Patient-level chat drawer (design.md 6.2, adapted) — Phase C item 6.
 *
 * A single conversation, hoisted to the patient layout so it persists as the
 * user navigates between entity pages (the layout doesn't remount on
 * child-route changes). Opened from any wiki surface's floating Ask AI button
 * via `useChatDrawer().openChat()`, or from the §6.1 dashboard chat bar via
 * `openWithMessage(text)` — which opens AND dispatches in one call; the page
 * behind the slide-over stays visible, so the user keeps the record in view
 * while asking. "Open full screen ↗" hands the persisted session to the §6.2
 * surface and the drawer starts fresh.
 *
 * Deviation from the 6.2 full-screen / 6.4:1354 "opens the full-screen chat"
 * spec, ratified with the user 2026-05-30 (drawer keeps context visible + the
 * thread alive across navigation). See decisions.md. The dedicated rail "Chat"
 * surface (6.2 three-column) still arrives with the rail in Phase D.
 *
 * The typed surface ref (lib/chat/surface-ref.ts) rides each message's request
 * body (sendMessage `body`), so the surface tag tracks whichever page the user
 * is on when they ask — one thread, page-aware framing. The route resolves the
 * ref server-side into the prose the prompt embeds; the client never sends
 * that string.
 *
 * Persistence + logging (2026-07-08): the drawer conversation is a real chat
 * session, not an ephemeral one — it lazily creates a `chat_sessions` row on the
 * first send, passes `sessionId` so `/api/chat` persists every turn + auto-titles
 * (identical to full-screen chat), and so drawer conversations show up in the
 * CHATS list. Typed input runs through the shared `useQuickLog` flow (§5.5
 * router: `question` → synthesis, `log` → quick-log → the §6.11 confirmation;
 * the drawer closes and after commit the user lands in the full-screen session,
 * where the log-ack continues the conversation). One conversation model across
 * both surfaces — not two fragmented ones.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { useQuickLog } from "@/components/chat/use-quick-log";
import type { SurfaceRef } from "@/lib/chat/surface-ref";
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
  setSurface: (surface?: SurfaceRef) => void;
  // Opens the drawer AND dispatches text into the conversation — the §6.1
  // dashboard chat bar's entry point. Canned chips are definitionally
  // questions (skip the router, like the drawer's own starters); typed input
  // goes through the §5.5 classify path like any other. If a turn is already
  // in flight, the text lands in the drawer input instead of being dropped.
  openWithMessage: (text: string, opts?: { isQuestion?: boolean }) => void;
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

// The route's 400 for a surface ref whose entity no longer resolves in-scope —
// the stale-tab race (entity deleted elsewhere while this page still shows it).
// The AI SDK transport throws the response body as the error message, so the
// shape is parseable; anything that doesn't parse is some other failure.
function isStaleSurfaceError(err: Error): boolean {
  try {
    const parsed = JSON.parse(err.message) as {
      error?: { code?: string; details?: { surface?: unknown } };
    };
    return (
      parsed.error?.code === "validation_failed" &&
      parsed.error.details?.surface !== undefined
    );
  } catch {
    return false;
  }
}

export function ChatDrawerProvider({
  patientId,
  children,
}: {
  patientId: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // The surface the user is currently on. Pages publish it via `setSurface`
  // (the floating Ask AI button does this on mount + on route change), so each
  // sent message is tagged with the live current page — even after the drawer
  // was opened elsewhere and the user navigated with it pinned open.
  const surfaceRef = useRef<SurfaceRef | undefined>(undefined);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // The drawer's persisted chat session (lazy-created on first send, like the
  // full-screen surface).
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Stale-surface self-heal: if a send 400s because the surface entity no
  // longer resolves (deleted in another tab), the stale ref would fail every
  // retry — so clear it and resubmit the same turn once, without the surface
  // tag. One-shot per send (reset in runQuestion) so a different failure can't
  // loop. Refs (not closures) because onError is captured at useChat() init.
  const retriedStaleSurfaceRef = useRef(false);
  const retrySendRef = useRef<() => void>(() => {});

  const { messages, sendMessage, setMessages, status, error } = useChat({
    onError: (err) => {
      if (retriedStaleSurfaceRef.current || !isStaleSurfaceError(err)) return;
      retriedStaleSurfaceRef.current = true;
      surfaceRef.current = undefined;
      // One tick later, not inline: onError fires while the failed request is
      // still unwinding inside the SDK, and re-entering sendMessage there
      // clobbers its in-flight response state (verified: the retry's stream
      // crashes client-side without this).
      setTimeout(() => retrySendRef.current(), 0);
    },
  });

  const isEmpty = messages.length === 0;

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status, open]);

  const setSurface = useCallback((surface?: SurfaceRef) => {
    surfaceRef.current = surface;
  }, []);
  const openChat = useCallback(() => setOpen(true), []);
  // Latest-ref dispatch for openWithMessage: the send paths (route/runQuestion/
  // busy) are defined below and change across renders; routing the call through
  // a ref keeps the context value stable so consumers (the floating button,
  // the dashboard bar) don't re-render on every stream tick.
  const dispatchRef = useRef<(text: string, isQuestion: boolean) => void>(
    () => {},
  );
  const openWithMessage = useCallback(
    (text: string, opts?: { isQuestion?: boolean }) => {
      setOpen(true);
      dispatchRef.current(text, opts?.isQuestion ?? false);
    },
    [],
  );
  const contextValue = useMemo(
    () => ({ openChat, setSurface, openWithMessage }),
    [openChat, setSurface, openWithMessage],
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
      retriedStaleSurfaceRef.current = false;
      // Arm the stale-surface retry for this send: resubmit the conversation
      // as-is (the failed user turn is still the last message; undefined text
      // means "re-submit current messages"), surface tag dropped.
      retrySendRef.current = () => {
        void sendMessage(undefined, { body: { sessionId: sid ?? undefined } });
      };
      sendMessage(
        { text },
        { body: { sessionId: sid ?? undefined, surface: surfaceRef.current } },
      );
    },
    [ensureSession, sendMessage],
  );

  // The shared §5.5→§6.11 quick-log flow (classify · log · nudge · declined ·
  // disambiguator · retry · confirmation navigation) — one implementation for
  // this drawer and the full-screen pane. The drawer closes before navigating
  // (§6.11 "NO floating Ask AI" during review); returnTo targets the persisted
  // session so the conversation continues after commit, falling back to the
  // page under the drawer only when session creation failed.
  const {
    routing,
    logging,
    pending,
    nudge,
    logError,
    route,
    skipNudge,
    resolvePendingAsLog,
    resolvePendingAsQuestion,
    retryLog,
    reset,
  } = useQuickLog({
    patientId,
    sessionId,
    ensureSession,
    setMessages,
    runQuestion,
    beforeNavigate: () => setOpen(false),
    fallbackReturnTo: pathname ?? `/patient/${patientId}`,
  });

  const busy =
    status === "submitted" ||
    status === "streaming" ||
    creating ||
    routing ||
    logging;

  // Keep the openWithMessage dispatch current (latest-ref pattern — see the
  // declaration above; effect-assigned per the no-ref-writes-in-render rule,
  // and dispatch only ever fires from user events, which run after effects).
  // Busy → park the text in the input rather than dropping it or interleaving
  // a second turn into an in-flight stream.
  useEffect(() => {
    dispatchRef.current = (text: string, isQuestion: boolean) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (busy) {
        setInput(trimmed);
        return;
      }
      if (isQuestion) void runQuestion(trimmed);
      else void route(trimmed);
    };
  });

  const submit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setInput("");
      await route(trimmed);
    },
    [busy, route],
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
    reset();
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
              {/* Continue this conversation on the full-screen surface — the
                  session is persisted, so this is just navigation. Disabled
                  mid-stream: navigating would abort the in-flight reply before
                  it persists (turns write after the response flushes). */}
              {sessionId && !isEmpty ? (
                busy ? (
                  <span
                    aria-disabled
                    className="text-sm text-stone-400"
                    title="Available once the current reply finishes"
                  >
                    Open full screen ↗
                  </span>
                ) : (
                  <Link
                    href={`/patient/${patientId}/chat/${sessionId}`}
                    onClick={() => {
                      // The conversation moves to the full-screen surface;
                      // the drawer relinquishes it so a later drawer open
                      // starts fresh instead of silently appending to a
                      // session whose newer turns it can't see.
                      setOpen(false);
                      startNewConversation();
                    }}
                    className="text-sm text-stone-500 underline-offset-4 hover:text-stone-800 hover:underline"
                  >
                    Open full screen ↗
                  </Link>
                )
              ) : null}
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
                    onClick={resolvePendingAsLog}
                  >
                    Log it
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={resolvePendingAsQuestion}
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

            {/* Quick-log failure — the echoed turn stays put; offer a retry so
                the log isn't silently dropped. (Parity with the full-screen
                pane, via the shared hook.) */}
            {logError ? (
              <div className="rounded-lg border border-border bg-muted p-4" aria-live="polite">
                <p className="text-sm text-foreground">
                  I couldn&apos;t log that just now — something interrupted it.
                </p>
                <div className="mt-3">
                  <Button type="button" size="sm" disabled={busy} onClick={retryLog}>
                    Try again
                  </Button>
                </div>
              </div>
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
