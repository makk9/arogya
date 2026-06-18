"use client";

import { useState, type ReactNode } from "react";

import { JournalEditProvider } from "@/components/journal/journal-edit-context";
import type { JournalEntry } from "@/db/schema";

interface Props {
  entry: JournalEntry;
  children: ReactNode;
}

/*
 * Client wrapper around the Journal detail page. Clones report-detail-shell:
 * events have no change log, so there is no log-change provider — just the edit
 * context whose Edit/Done button lives in the header.
 */
export function JournalDetailShell({ entry, children }: Props) {
  const [editing, setEditing] = useState(false);

  return (
    <JournalEditProvider value={{ editing, setEditing, entryId: entry.id }}>
      {children}
    </JournalEditProvider>
  );
}
