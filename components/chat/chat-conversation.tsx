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
}

export function ChatConversation({
  patientId,
  patientFirstName,
  sessionId: initialSessionId,
  initialMessages,
  title: initialTitle,
  onSessionCreated,
  onPersisted,
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

  const { messages, sendMessage, status, error } = useChat({
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

  const busy = status === "submitted" || status === "streaming" || creating;
  const isEmpty = messages.length === 0;

  // 6.2:1199 — follow-up chips appear only in the lull after the first reply
  // (exactly one assistant message, response settled), and disappear once the
  // next turn starts. "Most messages have no chips."
  const assistantCount = messages.filter((m) => m.role === "assistant").length;
  const showFollowUps = assistantCount === 1 && status === "ready";

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

  const submit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;

      let sid = sessionId;
      if (!sid) {
        // Lazy session creation on the first message of a fresh draft.
        setCreating(true);
        try {
          const res = await fetch("/api/chat/sessions", { method: "POST" });
          if (!res.ok) return;
          const body = (await res.json()) as { session: { id: string } };
          sid = body.session.id;
          setSessionId(sid);
          onSessionCreated(sid);
        } catch {
          return;
        } finally {
          setCreating(false);
        }
      }

      sendMessage({ text: trimmed }, { body: { sessionId: sid } });
      setInput("");
    },
    [busy, sessionId, onSessionCreated, sendMessage],
  );

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit(input);
  }

  async function saveRename() {
    const next = renameValue.trim();
    setRenaming(false);
    if (!sessionId || next.length === 0 || next === title) return;
    setTitle(next); // optimistic
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (res.ok) onPersisted();
    } catch {
      // Optimistic title stays; the next refetch reconciles it.
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
                    onClick={() => void submit(starter)}
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
                <div key={message.id} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600"
                  >
                    ✦
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="[&_li]:ml-4 [&_ol]:my-2 [&_ol]:ml-4 [&_ol]:list-decimal [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc">
                      <AiMessage markdown={textOf(message)} />
                    </div>
                    <MessageGrounding grounding={groundingFromText(textOf(message))} />
                  </div>
                </div>
              ),
            )
          )}

          {status === "submitted" ? (
            <div className="flex gap-3 text-stone-500" aria-live="polite">
              <span
                aria-hidden
                className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600"
              >
                ✦
              </span>
              <span className="pt-1">•••</span>
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-stone-500">
              Something interrupted that response. Try sending it again.
            </p>
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
                  onClick={() => void submit(followUp)}
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
              onClick={() => void submit(shortcut.prompt)}
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
            placeholder="Ask about this record, or log something new…"
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
