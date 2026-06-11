"use client";

import { useState, type ReactNode } from "react";

import { FamilyHistoryEditProvider } from "@/components/family-history/family-history-edit-context";
import type { FamilyHistoryEntry } from "@/db/schema";

interface Props {
  entry: FamilyHistoryEntry;
  children: ReactNode;
}

/*
 * Client wrapper around the detail page. The slimmest of the detail shells:
 * edit context only — FamilyHistory has no change log (§4:558), so there is
 * no log-change provider and no dialog to own. Clones
 * allergy-detail-shell.tsx minus that half.
 */
export function FamilyHistoryDetailShell({ entry, children }: Props) {
  const [editing, setEditing] = useState(false);

  const editProviderValue = {
    editing,
    setEditing,
    entryId: entry.id,
  };

  return (
    <FamilyHistoryEditProvider value={editProviderValue}>
      {children}
    </FamilyHistoryEditProvider>
  );
}
