"use client";

import { createContext, useContext, type ReactNode } from "react";

interface ConditionEditValue {
  editing: boolean;
  setEditing: (next: boolean) => void;
  conditionId: string;
}

const ConditionEditContext = createContext<ConditionEditValue | null>(null);

export function ConditionEditProvider({
  value,
  children,
}: {
  value: ConditionEditValue;
  children: ReactNode;
}) {
  return (
    <ConditionEditContext.Provider value={value}>
      {children}
    </ConditionEditContext.Provider>
  );
}

export function useConditionEdit(): ConditionEditValue {
  const ctx = useContext(ConditionEditContext);
  if (!ctx) {
    throw new Error(
      "useConditionEdit must be used inside <ConditionEditProvider>",
    );
  }
  return ctx;
}

// Optional read — InlineField needs this when used outside a provider. Returns
// null instead of throwing so callers can branch.
export function useMaybeConditionEdit(): ConditionEditValue | null {
  return useContext(ConditionEditContext);
}
