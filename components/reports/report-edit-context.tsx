"use client";

import { createContext, useContext, type ReactNode } from "react";

/*
 * Edit-mode context for the Report detail page. Clones visit-edit-context: the
 * Edit/Done toggle lives in the header; inline fields across all sections
 * subscribe here. Events have no change log, so this is the only edit surface
 * (no log-change provider sibling).
 */

interface ReportEditContextValue {
  editing: boolean;
  setEditing: (next: boolean) => void;
  reportId: string;
}

const ReportEditContext = createContext<ReportEditContextValue | null>(null);

export function ReportEditProvider({
  value,
  children,
}: {
  value: ReportEditContextValue;
  children: ReactNode;
}) {
  return (
    <ReportEditContext.Provider value={value}>
      {children}
    </ReportEditContext.Provider>
  );
}

export function useReportEdit(): ReportEditContextValue {
  const ctx = useContext(ReportEditContext);
  if (!ctx) {
    throw new Error("useReportEdit must be used within ReportEditProvider");
  }
  return ctx;
}

/** Null-safe variant for components that render outside the provider. */
export function useMaybeReportEdit(): ReportEditContextValue | null {
  return useContext(ReportEditContext);
}
