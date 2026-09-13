"use client";

/**
 * Full-screen chat surface shell (design.md 6.2) — owns the two columns that
 * sit to the right of the wiki rail: the CHATS history list and the active
 * conversation. (The rail itself is column one, supplied by the patient layout;
 * it stays visible — no ChatGPT-style takeover, 6.2:1190.)
 *
 * State it owns:
 *  - `sessions` — the history list, refetched after a reply persists (to pick up
 *    a new session and its auto-title) and after rename.
 *  - `activeId` — which row is highlighted. Seeded from the route on mount;
 *    updated directly during lazy session creation (where the URL is swapped in
 *    place via history.replaceState — no remount). Real navigation between
 *    sessions remounts this component (the page keys it on the route session
 *    id), so there's no prop→state sync to maintain.
 */

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  ChatHistoryList,
  type ChatSessionListItem,
} from "@/components/chat/chat-history-list";
import {
  ChatConversation,
  type InitialMessage,
} from "@/components/chat/chat-conversation";

interface FullScreenChatProps {
  patientId: string;
  patientFirstName: string;
  initialSessions: ChatSessionListItem[];
  // The route's session id — null on the `/chat` new-draft route.
  activeSessionId: string | null;
  initialMessages: InitialMessage[];
  initialTitle: string | null;
  // Fixed prompt auto-sent once on an empty draft (onboarding's health-scan
  // handoff, §6.3:1243). Server-resolved — never client free text.
  autorunPrompt?: string | null;
}

export function FullScreenChat({
  patientId,
  patientFirstName,
  initialSessions,
  activeSessionId,
  initialMessages,
  initialTitle,
  autorunPrompt = null,
}: FullScreenChatProps) {
  const [sessions, setSessions] = useState(initialSessions);
  const [activeId, setActiveId] = useState<string | null>(activeSessionId);
  // Remount key for the conversation pane. A draft that lazily became a
  // session swapped its URL in place (no remount), so the page — still keyed
  // "new" — isn't remounted when the user then navigates back to the bare
  // `/chat` route ("+ New conversation", or Delete's push). Next syncs
  // history.replaceState into usePathname, so we watch for that return and
  // reset the pane ourselves; otherwise the old conversation stays on screen
  // and the next send targets its (possibly deleted) session.
  const pathname = usePathname();
  const [paneKey, setPaneKey] = useState(0);
  const [sawSessionUrl, setSawSessionUrl] = useState(false);
  const draftPath = `/patient/${patientId}/chat`;
  if (activeSessionId === null && activeId !== null) {
    if (!sawSessionUrl && pathname === `${draftPath}/${activeId}`) {
      setSawSessionUrl(true);
    } else if (sawSessionUrl && pathname === draftPath) {
      setSawSessionUrl(false);
      setActiveId(null);
      setPaneKey((k) => k + 1);
    }
  }

  const refetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/sessions");
      if (!res.ok) return;
      const body = (await res.json()) as {
        sessions: { id: string; title: string | null }[];
      };
      setSessions(body.sessions.map((s) => ({ id: s.id, title: s.title })));
    } catch {
      // A failed refresh just leaves the list as-is; the next persist retries.
    }
  }, []);

  // Refetch on mount from the (always-fresh) API so the list reflects current DB
  // state — not just what the server component rendered. This is what surfaces
  // sessions started elsewhere, notably from the Ask-AI drawer on another route:
  // the drawer persists to the same chat_sessions table, but this surface would
  // otherwise only ever see the server-seeded `initialSessions` (frozen under
  // stub auth's static rendering) plus its own in-session creates. The state
  // update lands in the async callback (post-fetch), not synchronously.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/chat/sessions");
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as {
          sessions: { id: string; title: string | null }[];
        };
        if (!cancelled) {
          setSessions(body.sessions.map((s) => ({ id: s.id, title: s.title })));
        }
      } catch {
        // A failed refresh just leaves the server-seeded list in place.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSessionCreated = useCallback(
    (id: string) => {
      setActiveId(id);
      // Swap the address bar to the real conversation URL without a React
      // navigation — a router push/replace here would remount the pane and drop
      // the in-flight stream. Reload/reopen now resolves to /chat/[id].
      window.history.replaceState(null, "", `/patient/${patientId}/chat/${id}`);
      void refetchSessions();
    },
    [patientId, refetchSessions],
  );

  return (
    <div className="flex">
      <ChatHistoryList
        patientId={patientId}
        sessions={sessions}
        activeId={activeId}
      />
      {/* The page keys this whole component on the route session id, so real
          navigation already remounts the conversation. Lazy session creation
          deliberately does NOT remount (it swaps the URL in place to keep the
          in-flight stream alive); `paneKey` covers the return-to-draft case. */}
      <ChatConversation
        key={paneKey}
        patientId={patientId}
        patientFirstName={patientFirstName}
        sessionId={activeSessionId}
        initialMessages={initialMessages}
        title={initialTitle}
        onSessionCreated={onSessionCreated}
        onPersisted={refetchSessions}
        autorunPrompt={autorunPrompt}
      />
    </div>
  );
}
