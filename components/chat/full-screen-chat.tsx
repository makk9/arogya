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

import { useCallback, useState } from "react";

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
}

export function FullScreenChat({
  patientId,
  patientFirstName,
  initialSessions,
  activeSessionId,
  initialMessages,
  initialTitle,
}: FullScreenChatProps) {
  const [sessions, setSessions] = useState(initialSessions);
  const [activeId, setActiveId] = useState<string | null>(activeSessionId);

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
      {/* No key needed: the page keys this whole component on the route session
          id, so real navigation already remounts the conversation. Lazy session
          creation deliberately does NOT remount (it swaps the URL in place to
          keep the in-flight stream alive). */}
      <ChatConversation
        patientId={patientId}
        patientFirstName={patientFirstName}
        sessionId={activeSessionId}
        initialMessages={initialMessages}
        title={initialTitle}
        onSessionCreated={onSessionCreated}
        onPersisted={refetchSessions}
      />
    </div>
  );
}
