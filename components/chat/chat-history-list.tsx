"use client";

/**
 * CHATS history column (design.md 6.2:1189) — the middle column of the
 * three-column chat surface, between the wiki rail and the conversation pane.
 * Collapsible ("CHATS <"), lists the patient's sessions most-recently-active
 * first, and offers `+ new` to start a fresh draft.
 *
 * Pure navigation: each row is a <Link> to /chat/[id]; the active session is
 * highlighted. Rename/delete live in the conversation header's … menu
 * (6.2:1193), not here.
 */

import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export interface ChatSessionListItem {
  id: string;
  title: string | null;
}

interface ChatHistoryListProps {
  patientId: string;
  sessions: ChatSessionListItem[];
  activeId: string | null;
}

export function ChatHistoryList({
  patientId,
  sessions,
  activeId,
}: ChatHistoryListProps) {
  const [collapsed, setCollapsed] = useState(false);
  const base = `/patient/${patientId}/chat`;

  if (collapsed) {
    return (
      <div className="flex h-screen w-12 shrink-0 flex-col items-center gap-2 border-r py-4">
        <button
          type="button"
          aria-label="Expand chat list"
          onClick={() => setCollapsed(false)}
          className="text-stone-500 hover:text-stone-800"
        >
          <PanelLeftOpen className="h-5 w-5" />
        </button>
        <Link
          href={base}
          aria-label="New conversation"
          className="text-stone-500 hover:text-stone-800"
        >
          <Plus className="h-5 w-5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-64 shrink-0 flex-col border-r">
      <div className="flex items-center justify-between px-3 py-4">
        <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
          Chats
        </span>
        <button
          type="button"
          aria-label="Collapse chat list"
          onClick={() => setCollapsed(true)}
          className="text-stone-500 hover:text-stone-800"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <Link
        href={base}
        className={cn(
          "mx-2 mb-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-stone-700 transition-colors hover:bg-stone-100",
          activeId === null && "bg-stone-100 font-medium",
        )}
      >
        <Plus className="h-4 w-4" /> New conversation
      </Link>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {sessions.length === 0 ? (
          <p className="px-3 py-2 text-sm text-stone-400">
            No conversations yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {sessions.map((session) => (
              <li key={session.id}>
                <Link
                  href={`${base}/${session.id}`}
                  className={cn(
                    "block truncate rounded-md px-3 py-2 text-sm text-stone-700 transition-colors hover:bg-stone-100",
                    session.id === activeId && "bg-stone-100 font-medium",
                  )}
                >
                  {session.title?.trim() || "New conversation"}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </div>
  );
}
