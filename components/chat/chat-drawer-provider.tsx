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
 */

import {
  createContext,
  useContext,
  useEffect,
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
  openChat: (surfaceContext?: string) => void;
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

export function ChatDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Tags each message with the surface the user is on when they send it.
  const surfaceContextRef = useRef<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error } = useChat();

  const busy = status === "submitted" || status === "streaming";
  const isEmpty = messages.length === 0;

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status, open]);

  function openChat(surfaceContext?: string) {
    surfaceContextRef.current = surfaceContext;
    setOpen(true);
  }

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed }, { body: { surfaceContext: surfaceContextRef.current } });
    setInput("");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submit(input);
  }

  return (
    <ChatDrawerContext.Provider value={{ openChat }}>
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
            <SheetClose className="text-sm text-stone-500 underline-offset-4 hover:text-stone-800 hover:underline">
              Close
            </SheetClose>
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
                      onClick={() => submit(starter)}
                      className="rounded-full border border-stone-300 px-3 py-1.5 text-sm text-stone-700 transition-colors hover:border-stone-400 hover:bg-stone-50"
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
                    {/* Stone tint stands in for the 6.2 terra/clay user bubble
                        until the brand accent lands (decisions 2026-05-20). */}
                    <div className="max-w-[80%] rounded-2xl bg-stone-100 px-4 py-2.5 text-stone-900 ring-1 ring-stone-200">
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

            {status === "submitted" ? (
              <div className="flex gap-3 text-stone-500" aria-live="polite">
                <span
                  aria-hidden
                  className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600"
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

            <div ref={bottomRef} />
          </div>

          <form onSubmit={onSubmit} className="border-t p-4">
            <div className="flex items-end gap-2">
              <Textarea
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
