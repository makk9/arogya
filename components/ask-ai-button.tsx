"use client";

import { useEffect } from "react";

import { useChatDrawer } from "@/components/chat/chat-drawer-provider";
import type { SurfaceRef } from "@/lib/chat/surface-ref";
import { cn } from "@/lib/utils";

/*
 * Global floating Ask AI button (design.md 6.4:1354 + 6.5) — opens the chat
 * drawer with this surface's context pre-loaded (5.3), keeping the page visible
 * behind the slide-over. Renders on every state/event list + detail page; never
 * on the dashboard, chat, onboarding, extraction-confirmation, structured-form,
 * or settings surfaces (6.4:1356).
 *
 * `surface` is a typed ref (key + entity id for detail pages) — the chat route
 * resolves it server-side into the prose the prompt embeds, so the client never
 * authors that string. Undefined → no surface bias.
 */
export function AskAiButton({
  surface,
  className,
}: {
  surface?: SurfaceRef;
  className?: string;
}) {
  const { openChat, setSurface } = useChatDrawer();

  // Publish this page's surface to the drawer on mount + whenever the route's
  // surface changes, so the drawer (which stays open across navigation) tags
  // each message with the page the user is currently on — not just where it
  // was first opened. The ref object is fresh per render, so the effect re-runs
  // more than strictly needed — harmless, it's a mutable-ref write.
  useEffect(() => {
    setSurface(surface);
  }, [surface, setSurface]);

  return (
    <button
      type="button"
      onClick={openChat}
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
