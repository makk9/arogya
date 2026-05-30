"use client";

import { useChatDrawer } from "@/components/chat/chat-drawer-provider";
import { cn } from "@/lib/utils";

/*
 * Global floating Ask AI button (design.md 6.4:1354 + 6.5) — opens the chat
 * drawer with this surface's context pre-loaded (5.3), keeping the page visible
 * behind the slide-over. Renders on every state/event list + detail page; never
 * on the dashboard, chat, onboarding, extraction-confirmation, structured-form,
 * or settings surfaces (6.4:1356).
 *
 * `surfaceContext` is built by the page (it already holds the entity) and passed
 * in; the drawer tags each message with it. Undefined → no surface bias.
 */
export function AskAiButton({
  surfaceContext,
  className,
}: {
  surfaceContext?: string;
  className?: string;
}) {
  const { openChat } = useChatDrawer();
  return (
    <button
      type="button"
      onClick={() => openChat(surfaceContext)}
      className={cn(
        "fixed bottom-6 right-6 z-40 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      <span aria-hidden>✦</span>
      Ask AI
    </button>
  );
}
