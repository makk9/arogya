"use client";

import { createContext, useContext, type ReactNode } from "react";

interface FamilyHistoryEditValue {
  editing: boolean;
  setEditing: (next: boolean) => void;
  entryId: string;
}

const FamilyHistoryEditContext = createContext<FamilyHistoryEditValue | null>(
  null,
);

export function FamilyHistoryEditProvider({
  value,
  children,
}: {
  value: FamilyHistoryEditValue;
  children: ReactNode;
}) {
  return (
    <FamilyHistoryEditContext.Provider value={value}>
      {children}
    </FamilyHistoryEditContext.Provider>
  );
}

export function useFamilyHistoryEdit(): FamilyHistoryEditValue {
  const ctx = useContext(FamilyHistoryEditContext);
  if (!ctx) {
    throw new Error(
      "useFamilyHistoryEdit must be used inside <FamilyHistoryEditProvider>",
    );
  }
  return ctx;
}

// Optional read — InlineField needs this when used outside a provider. Returns
// null instead of throwing so callers can branch.
export function useMaybeFamilyHistoryEdit(): FamilyHistoryEditValue | null {
  return useContext(FamilyHistoryEditContext);
}
