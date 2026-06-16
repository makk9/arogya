"use client";

import { createContext, useContext, type ReactNode } from "react";

/*
 * Edit-mode context for the Visit detail page. Clones allergy-edit-context:
 * the Edit/Done toggle lives in the header; inline fields across all sections
 * subscribe here. Events have no change log, so this is the only edit surface
 * (no log-change provider sibling).
 */

interface VisitEditContextValue {
  editing: boolean;
  setEditing: (next: boolean) => void;
  visitId: string;
}

const VisitEditContext = createContext<VisitEditContextValue | null>(null);

export function VisitEditProvider({
  value,
  children,
}: {
  value: VisitEditContextValue;
  children: ReactNode;
}) {
  return (
    <VisitEditContext.Provider value={value}>
      {children}
    </VisitEditContext.Provider>
  );
}

export function useVisitEdit(): VisitEditContextValue {
  const ctx = useContext(VisitEditContext);
  if (!ctx) {
    throw new Error("useVisitEdit must be used within VisitEditProvider");
  }
  return ctx;
}

/** Null-safe variant for components that render outside the provider. */
export function useMaybeVisitEdit(): VisitEditContextValue | null {
  return useContext(VisitEditContext);
}
