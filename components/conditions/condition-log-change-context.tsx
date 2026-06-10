"use client";

import { createContext, useContext, type ReactNode } from "react";

// Two consumers (History section's `+ Log a change` button + Current section's
// in-edit-mode hint) need to open the same dialog the shell owns. Cheaper than
// prop-drilling; smaller than folding the open state into ConditionEditContext
// (those concerns are unrelated).

interface ConditionLogChangeValue {
  open: () => void;
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
