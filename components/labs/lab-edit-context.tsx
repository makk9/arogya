"use client";

import { createContext, useContext, type ReactNode } from "react";

/*
 * Edit-mode context for the Lab report detail page. Clones visit-edit-context:
 * the Edit/Done toggle lives in the header; report-level inline fields subscribe
 * here. Events have no change log, so this is the only report-level edit surface
 * (the MARKERS table is read-only — corrections route through their own dialog,
 * not this context).
 */

interface LabEditContextValue {
  editing: boolean;
  setEditing: (next: boolean) => void;
  reportId: string;
}

const LabEditContext = createContext<LabEditContextValue | null>(null);

export function LabEditProvider({
  value,
  children,
}: {
  value: LabEditContextValue;
  children: ReactNode;
}) {
  return (
    <LabEditContext.Provider value={value}>{children}</LabEditContext.Provider>
  );
}

export function useLabEdit(): LabEditContextValue {
  const ctx = useContext(LabEditContext);
  if (!ctx) {
    throw new Error("useLabEdit must be used within LabEditProvider");
  }
  return ctx;
}

/** Null-safe variant for components that render outside the provider. */
export function useMaybeLabEdit(): LabEditContextValue | null {
  return useContext(LabEditContext);
}
