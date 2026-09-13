"use client";

/**
 * Full-screen chat conversation pane (design.md 6.2) — the rightmost column of
 * the three-column surface (rail · CHATS list · this). Unlike the ephemeral
 * Ask-AI drawer, every turn here persists against a chat session, the
 * conversation reopens with its history, and the header surfaces grounding.
 *
 * Session lifecycle: an existing conversation arrives with a `sessionId` and
 * seeded `initialMessages`. A fresh `/chat` draft arrives with `sessionId =
 * null`; the session is created lazily on the first send (no empty orphan rows
 * from merely opening the surface), then `onSessionCreated` swaps the URL to
 * `/chat/[id]` so reload/reopen works.
 */

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { MoreHorizontal } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { type UIMessage } from "ai";

import { AiMessage } from "@/components/ai-message";
import { MessageGrounding } from "@/components/chat/chat-grounding";
import { useQuickLog } from "@/components/chat/use-quick-log";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { briefModeOf } from "@/lib/chat/brief";
import { groundingFromText } from "@/lib/citations/grounding";

// 6.2:1215 empty-conversation starters. "Generate a doctor brief" is omitted —
// the brief capability is Phase E item E7 (5.7), so offering it now would
// dead-end; it returns here once that capability ships.
const STARTERS = [
  "Run a full health scan",
  "Investigate a concern",
  "Prep for an appointment",
] as const;

// 6.2:1199 contextual suggested actions — "after the first AI response in a
// fresh conversation, suggest 2-3 follow-ups… most messages have no chips." v1
// uses a fixed, generally-useful set rather than reply-derived suggestions
// (truly contextual generation would need an extra model call — deferred; see
// decisions.md). Shown only in the window after the first reply, gone once the
// next message is sent.
const FOLLOW_UPS = [
  "What should I raise with the doctor?",
  "Has anything changed recently?",
  "What else should I keep an eye on?",
] as const;

// 6.2:1200 bottom-strip shortcuts — persistent quick-access actions independent
// of conversation state. Each submits a fixed prompt through the same router/
// synthesis path as typed input.
const SHORTCUTS = [
  { label: "Prep next visit", prompt: "Help me prep for the next visit." },
  {
    label: "Med interactions",
    prompt: "Are there any interactions to be aware of between the current medications?",
  },
  {
    label: "Trend in 90d",
    prompt: "What are the most important trends over the last 90 days?",
  },
] as const;

export interface InitialMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function toUIMessage(m: InitialMessage): UIMessage {
  return { id: m.id, role: m.role, parts: [{ type: "text", text: m.content }] };
}

function textOf(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

interface ChatConversationProps {
  patientId: string;
  // The patient's first name — names the subject in the empty-state copy
  // (7.1 voice: the patient is named, never "the patient").
  patientFirstName: string;
  sessionId: string | null;
  initialMessages: InitialMessage[];
  // Server-stored title (null until auto-titled). The header falls back to the
  // first user message while null.
  title: string | null;
  onSessionCreated: (sessionId: string) => void;
  // Called after a reply finishes streaming, or after rename, so the parent can
  // refetch the history list (new session + freshly-set auto-title / new name).
  onPersisted: () => void;
  // Fixed prompt auto-sent once when an empty draft mounts (onboarding's
  // health-scan handoff). Resolved server-side from `?run=scan` — a switch,
  // never client free text.
  autorunPrompt?: string | null;
}

export function ChatConversation({
  patientId,
  patientFirstName,
  sessionId: initialSessionId,
  initialMessages,
  title: initialTitle,
  onSessionCreated,
  onPersisted,
  autorunPrompt = null,
}: ChatConversationProps) {
  const router = useRouter();
  // Session id as state (not a ref) so the header … menu appears the moment a
  // fresh draft's session is created on first send.
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [title, setTitle] = useState<string | null>(initialTitle);
  const [input, setInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // A draft conversation arrives with no seeded messages; its first reply is the
  // one that gets an auto-title (set server-side in an after() callback, just
  // after the response). Used to schedule a single delayed list-refresh to catch
  // that title — reopened conversations are already titled, so they skip it.
  const isFreshConversation = initialMessages.length === 0;
  const titleCatchRef = useRef(false);
  const titleTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (titleTimerRef.current !== null) {
        window.clearTimeout(titleTimerRef.current);
      }
    },
    [],
  );

  const seeded = useMemo(
    () => initialMessages.map(toUIMessage),
    [initialMessages],
  );

  const { messages, sendMessage, setMessages, status, error } = useChat({
    messages: seeded,
    // No per-turn refetch: the CHATS list only needs refreshing when this
    // conversation's title lands. That happens once, shortly after the first
    // reply of a fresh conversation (the session itself was already added to the
    // list at creation time). Other turns leave the list untouched.
    onFinish: () => {
      if (isFreshConversation && !titleCatchRef.current) {
        titleCatchRef.current = true;
        titleTimerRef.current = window.setTimeout(() => onPersisted(), 2000);
      }
    },
  });

  const isEmpty = messages.length === 0;

  // 6.2:1199 — follow-up chips appear only in the lull after the first reply
  // (exactly one assistant message, response settled), and disappear once the
  // next turn starts. "Most messages have no chips."
  const assistantCount = messages.filter((m) => m.role === "assistant").length;
  const showFollowUps = assistantCount === 1 && status === "ready";

  // E7 — doctor-brief messages get a `Download PDF` action (5.7). Briefs are
  // addressed by position among the session's brief-marked assistant messages,
  // matching the brief-pdf route's `index` param (a freshly streamed message
  // has no DB row id client-side, so position is the shared address).
  const briefIndexById = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of messages) {
      if (m.role === "assistant" && briefModeOf(textOf(m)) !== null) {
        map.set(m.id, map.size);
      }
    }
    return map;
  }, [messages]);
  const lastMessageId = messages[messages.length - 1]?.id;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  // Header title: server title once set, else the first user message as the
  // fallback shorthand (6.2:1215 — no header until there's content).
  const displayTitle = useMemo(() => {
    if (title && title.trim().length > 0) return title;
    const firstUser = messages.find((m) => m.role === "user");
    if (firstUser) {
      const text = textOf(firstUser).trim();
      return text.length > 60 ? `${text.slice(0, 59)}…` : text;
    }
    return null;
  }, [title, messages]);

  // Lazy session creation on the first send of a fresh draft (no empty orphan
  // rows from merely opening the surface). Returns the id, or null on failure.
  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    setCreating(true);
    try {
      const res = await fetch("/api/chat/sessions", { method: "POST" });
      if (!res.ok) return null;
      const body = (await res.json()) as { session: { id: string } };
      setSessionId(body.session.id);
      onSessionCreated(body.session.id);
      return body.session.id;
    } catch {
      return null;
    } finally {
      setCreating(false);
    }
  }, [sessionId, onSessionCreated]);

  // Question → synthesis stream (the existing path). Canned chips call this
  // directly (they're definitionally questions); typed input reaches it via the
  // router's `question` branch.
  const runQuestion = useCallback(
    async (text: string) => {
      const sid = await ensureSession();
      if (!sid) return;
      sendMessage({ text }, { body: { sessionId: sid } });
    },
    [ensureSession, sendMessage],
  );

  // Onboarding handoff: fire the fixed prompt once on an empty draft. Ref-
  // guarded so a re-render never double-sends.
  const autorunFiredRef = useRef(false);
  useEffect(() => {
    if (!autorunPrompt || autorunFiredRef.current) return;
    if (initialSessionId !== null || initialMessages.length > 0) return;
    autorunFiredRef.current = true;
    // Deferred so the send's state updates happen outside the effect body.
    queueMicrotask(() => void runQuestion(autorunPrompt));
  }, [autorunPrompt, initialSessionId, initialMessages.length, runQuestion]);

  // The shared §5.5→§6.11 quick-log flow (classify · log · nudge · declined ·
  // disambiguator · retry · confirmation navigation) — one implementation for
  // this pane and the Ask-AI drawer.
  const {
    routing,
    logging,
    pending,
    nudge,
    logError,
    route,
    ask,
    skipNudge,
    resolvePendingAsLog,
    resolvePendingAsQuestion,
    retryLog,
  } = useQuickLog({
    patientId,
    sessionId,
    ensureSession,
    setMessages,
    runQuestion,
    onPersisted,
    fallbackReturnTo: `/patient/${patientId}/chat`,
  });

  const busy =
    status === "submitted" ||
    status === "streaming" ||
    creating ||
    routing ||
    logging;

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

  async function saveRename() {
    const next = renameValue.trim();
    setRenaming(false);
    if (!sessionId || next.length === 0 || next === title) return;
    const previous = title;
    setTitle(next); // optimistic
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (res.ok) onPersisted();
      else setTitle(previous);
    } catch {
      // The header reads local state, so a list refetch wouldn't correct it.
      setTitle(previous);
    }
  }

  async function confirmDelete() {
    if (!sessionId) return;
    try {
      await fetch(`/api/chat/sessions/${sessionId}`, { method: "DELETE" });
    } catch {
      // Fall through to navigation regardless — a failed delete just leaves the
      // session in place, and the list refresh will show it again.
    }
    router.push(`/patient/${patientId}/chat`);
    router.refresh();
  }

  return (
    <div className="flex h-screen min-w-0 flex-1 flex-col">
      {/* Conversation header — title + … menu (6.2:1193). Hidden on an empty
          draft per 6.2:1215. The conversation-level "grounded in:" line
          (6.2:1192) is intentionally dropped: it duplicated the per-message
          footer and, wrapping across the header, ate a chunk of the chat width
          (2026-06-29 — see decisions.md). Grounding lives in the per-message
          `grounded in →` footer (6.2:1207). */}
      {displayTitle ? (
        <header className="flex items-start justify-between gap-4 border-b px-6 py-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            {renaming ? (
              <Input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => void saveRename()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void saveRename();
                  } else if (e.key === "Escape") {
                    setRenaming(false);
                  }
                }}
                className="h-8 text-lg font-medium"
              />
            ) : (
              <h1 className="truncate text-lg font-medium text-foreground">
                {displayTitle}
              </h1>
            )}
          </div>

          {sessionId ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Conversation actions"
                  >
                    <MoreHorizontal />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setRenameValue(title ?? displayTitle ?? "");
                    setRenaming(true);
                  }}
                >
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </header>
      ) : null}

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {isEmpty ? (
            <div className="flex flex-col gap-4 pt-6">
              <p className="text-muted-foreground">
                Ask me anything about {patientFirstName}&apos;s health — I read
                the whole record before answering, so you don&apos;t have to find
                the right page first.
              </p>
              <div className="flex flex-wrap gap-2">
                {STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    disabled={busy}
                    onClick={() => ask(starter)}
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
                  {/* Periwinkle-tinted user bubble — the 6.2 accent slot,
                      matching the drawer (periwinkle locked 2026-05-31). */}
                  <div className="max-w-[80%] rounded-2xl bg-accent px-4 py-2.5 text-accent-foreground ring-1 ring-accent-foreground/15">
                    {textOf(message)}
                  </div>
                </div>
              ) : (
                <div
                  key={message.id}
                  className="min-w-0 [&_li]:ml-4 [&_ol]:my-2 [&_ol]:ml-4 [&_ol]:list-decimal [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc"
                >
                  {/* AiMessage supplies the single ✦ avatar + markdown body —
                      no outer avatar here (that double-rendered the sparkle). */}
                  <AiMessage markdown={textOf(message)} />
                  {/* Align the grounding footer under the body: past the avatar
                      (w-6) + gap-3 = ml-9. */}
                  <div className="ml-9">
                    <MessageGrounding grounding={groundingFromText(textOf(message))} />
                    {/* Only once the turn has settled — mid-stream the message
                        isn't persisted yet, so the route couldn't find it. */}
                    {sessionId !== null &&
                    briefIndexById.has(message.id) &&
                    !(busy && message.id === lastMessageId) ? (
                      <a
                        href={`/api/chat/sessions/${sessionId}/brief-pdf?index=${briefIndexById.get(message.id)}`}
                        download
                        className="mt-2 inline-flex items-center gap-1 rounded-md border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-700 transition-colors hover:border-stone-400 hover:bg-stone-50"
                      >
                        Download PDF
                      </a>
                    ) : null}
                  </div>
                </div>
              ),
            )
          )}

          {/* Thinking indicator — synthesis (`submitted`), the router classify
              window (`routing`), and the log-extraction window (`logging`), so a
              log doesn't feel frozen while it classifies + extracts before
              navigating, and reads as "logging" rather than a generic wait. */}
          {status === "submitted" || routing || logging ? (
            <div className="flex gap-3 text-stone-500" aria-live="polite">
              <span
                aria-hidden
                className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600"
              >
                ✦
              </span>
              <span className="pt-1">
                {logging
                  ? "Logging that — taking you to review…"
                  : routing
                    ? "Reading that…"
                    : "•••"}
              </span>
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-stone-500">
              Something interrupted that response. Try sending it again.
            </p>
          ) : null}

          {/* Quick-log failure — the echoed turn stays put; offer a retry so the
              log isn't silently dropped. */}
          {logError ? (
            <div className="flex gap-3" aria-live="polite">
              <span
                aria-hidden
                className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600"
              >
                ✦
              </span>
              <div className="min-w-0 flex-1 rounded-lg border border-border bg-muted p-4">
                <p className="text-sm text-foreground">
                  I couldn&apos;t log that just now — something interrupted it.
                </p>
                <div className="mt-3">
                  <Button type="button" size="sm" disabled={busy} onClick={retryLog}>
                    Try again
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Guided-scribe nudge — the agent asked for optional context (the
              question is the assistant turn above). Type the answer, or skip. */}
          {nudge ? (
            <div className="flex flex-wrap gap-2 pl-9">
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

          {/* 5.5 inline disambiguator — when the router can't confidently tell a
              log from a question, ask one click rather than guess wrong. */}
          {pending ? (
            <div className="flex gap-3">
              <span
                aria-hidden
                className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600"
              >
                ✦
              </span>
              <div className="min-w-0 flex-1 rounded-lg border border-border bg-muted p-4">
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
            </div>
          ) : null}

          {/* 6.2:1199 contextual follow-ups — only in the lull after the first
              reply. Indented to align under the AI message column. */}
          {showFollowUps ? (
            <div className="flex flex-wrap gap-2 pl-9">
              {FOLLOW_UPS.map((followUp) => (
                <button
                  key={followUp}
                  type="button"
                  disabled={busy}
                  onClick={() => ask(followUp)}
                  className="rounded-full border border-stone-300 px-3 py-1.5 text-sm text-stone-700 transition-colors hover:border-stone-400 hover:bg-stone-50 disabled:opacity-50"
                >
                  {followUp}
                </button>
              ))}
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* 6.2:1200 bottom-strip shortcuts — persistent, independent of
          conversation state. Sits above the input as a lightweight utility row,
          visually quieter than the empty-state starters. */}
      <div className="border-t px-6 pt-3">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
          {SHORTCUTS.map((shortcut) => (
            <button
              key={shortcut.label}
              type="button"
              disabled={busy}
              onClick={() => ask(shortcut.prompt)}
              className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600 transition-colors hover:bg-stone-200 disabled:opacity-50"
            >
              {shortcut.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={onSubmit} className="px-6 pb-4 pt-3">
        <div className="mx-auto flex max-w-3xl items-end gap-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit(input);
              }
            }}
            placeholder={
              nudge ? "Add the details, or just log it…" : "Ask about this record, or log something new…"
            }
            rows={1}
            className="max-h-40 min-h-[2.75rem] flex-1 resize-none"
          />
          <Button type="submit" disabled={busy || input.trim().length === 0}>
            Send
          </Button>
        </div>
      </form>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              {displayTitle
                ? `"${displayTitle}" and its messages will be removed. `
                : "This conversation and its messages will be removed. "}
              This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep conversation</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void confirmDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
