"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { History } from "lucide-react";

import { useChatDrawer } from "@/components/chat/chat-drawer-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/*
 * §6.1:1153 dashboard chat surface — bottom of the page, the natural
 * next-action position after scanning status (§6.1:1147 locked the reversal
 * of the centerpiece framing). Submitting opens the Ask-AI drawer with the
 * text dispatched into it — the same beside-the-page pattern as every entity
 * page's floating button, so the user keeps the cards they just scanned in
 * view while asking (user decision 2026-07-22; supersedes the brief
 * full-screen `?draft=` handoff). The drawer session persists, and its
 * "Open full screen ↗" continues the conversation on the §6.2 surface.
 *
 * Typed input travels the §5.5 classify path (it may be a log); chips are
 * definitionally questions and skip the router, like the drawer's starters.
 *
 * Anatomy per §6.1: suggested-action chips above the input · chat-history
 * clock icon on the input bar's left (→ the full-screen CHATS list) · the
 * trust tagline below.
 */

const SUGGESTED_ACTIONS = [
  "Run a full health scan",
  "Investigate a concern",
  "Prep for an appointment",
] as const;

export function DashboardChatBar({
  patientId,
  patientFirstName,
}: {
  patientId: string;
  patientFirstName: string;
}) {
  const router = useRouter();
  const { openWithMessage, setSurface } = useChatDrawer();
  const [input, setInput] = useState("");

  // Publish the dashboard surface so drawer messages sent from here carry it
  // (same pattern as AskAiButton on entity pages).
  useEffect(() => {
    setSurface({ key: "dashboard" });
  }, [setSurface]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");
    openWithMessage(trimmed);
  }

  return (
    <section aria-label="Ask about the record">
      <div className="mb-2 flex flex-wrap gap-2">
        {SUGGESTED_ACTIONS.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => openWithMessage(action, { isQuestion: true })}
            className="rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground/80 transition-colors hover:border-accent-foreground/40 hover:bg-accent hover:text-accent-foreground"
          >
            {action}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Chat history"
          onClick={() => router.push(`/patient/${patientId}/chat`)}
        >
          <History />
        </Button>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask about ${patientFirstName}'s health record…`}
          aria-label="Ask about the health record"
          className="flex-1"
        />
        <Button type="submit" disabled={input.trim().length === 0}>
          Ask
        </Button>
      </form>

      <p className="mt-2 text-center text-xs text-muted-foreground">
        grounded in {patientFirstName}&apos;s vault · cites every claim
      </p>
    </section>
  );
}
