"use client";

import { createContext, useContext, type ReactNode } from "react";

/*
 * Edit-mode context for the SymptomType detail page (the state-style parent
 * surface). Clones the state-entity edit context. SymptomType has NO change log
 * (no symptom_type_changes table — §4), so status/linked-condition are plain
 * PATCH-able inline fields, unlike Condition's change-logged status. This is the
 * only edit surface; there's no log-change provider sibling.
 */

interface TypeEditContextValue {
  editing: boolean;
  setEditing: (next: boolean) => void;
  typeId: string;
}

const TypeEditContext = createContext<TypeEditContextValue | null>(null);

export function TypeEditProvider({
  value,
  children,
}: {
  value: TypeEditContextValue;
  children: ReactNode;
}) {
  return (
    <TypeEditContext.Provider value={value}>
      {children}
    </TypeEditContext.Provider>
  );
}

export function useTypeEdit(): TypeEditContextValue {
  const ctx = useContext(TypeEditContext);
  if (!ctx) {
    throw new Error("useTypeEdit must be used within TypeEditProvider");
  }
  return ctx;
}

export function useMaybeTypeEdit(): TypeEditContextValue | null {
  return useContext(TypeEditContext);
}
