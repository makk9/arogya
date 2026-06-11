"use client";

import { createContext, useContext, type ReactNode } from "react";

interface AllergyEditValue {
  editing: boolean;
  setEditing: (next: boolean) => void;
  allergyId: string;
}

const AllergyEditContext = createContext<AllergyEditValue | null>(null);

export function AllergyEditProvider({
  value,
  children,
}: {
  value: AllergyEditValue;
  children: ReactNode;
}) {
  return (
    <AllergyEditContext.Provider value={value}>
      {children}
    </AllergyEditContext.Provider>
  );
}

export function useAllergyEdit(): AllergyEditValue {
  const ctx = useContext(AllergyEditContext);
  if (!ctx) {
    throw new Error("useAllergyEdit must be used inside <AllergyEditProvider>");
  }
  return ctx;
}

// Optional read — InlineField needs this when used outside a provider. Returns
// null instead of throwing so callers can branch.
export function useMaybeAllergyEdit(): AllergyEditValue | null {
  return useContext(AllergyEditContext);
}
