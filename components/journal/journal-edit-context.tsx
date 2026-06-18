"use client";

import { createContext, useContext, type ReactNode } from "react";

/*
 * Edit-mode context for the Journal detail page. Clones report-edit-context: the
 * Edit/Done toggle lives in the header; inline fields subscribe here. Events have
 * no change log, so this is the only edit surface.
 */

interface JournalEditContextValue {
  editing: boolean;
  setEditing: (next: boolean) => void;
  entryId: string;
}

const JournalEditContext = createContext<JournalEditContextValue | null>(null);

export function JournalEditProvider({
  value,
  children,
}: {
  value: JournalEditContextValue;
  children: ReactNode;
}) {
  return (
    <JournalEditContext.Provider value={value}>
      {children}
    </JournalEditContext.Provider>
  );
}

export function useJournalEdit(): JournalEditContextValue {
  const ctx = useContext(JournalEditContext);
  if (!ctx) {
    throw new Error("useJournalEdit must be used within JournalEditProvider");
  }
  return ctx;
}

/** Null-safe variant for components that render outside the provider. */
export function useMaybeJournalEdit(): JournalEditContextValue | null {
  return useContext(JournalEditContext);
}
