"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { ConditionChangeFormValues } from "@/lib/schemas/forms/condition";

// Consumers (History section's `+ Log a change` button + Current section's
// clickable value cards) need to open the same dialog the shell owns. Passing
// a field preselects it in the dialog — the click-where-the-data-is entry
// point (decisions.md 2026-08-12). Cheaper than prop-drilling; smaller than
// folding the open state into ConditionEditContext (those concerns are
// unrelated).

interface ConditionLogChangeValue {
  open: (field?: ConditionChangeFormValues["field"]) => void;
}

const ConditionLogChangeContext =
  createContext<ConditionLogChangeValue | null>(null);

export function ConditionLogChangeProvider({
  value,
  children,
}: {
  value: ConditionLogChangeValue;
  children: ReactNode;
}) {
  return (
    <ConditionLogChangeContext.Provider value={value}>
      {children}
    </ConditionLogChangeContext.Provider>
  );
}

export function useMaybeConditionLogChange(): ConditionLogChangeValue | null {
  return useContext(ConditionLogChangeContext);
}
