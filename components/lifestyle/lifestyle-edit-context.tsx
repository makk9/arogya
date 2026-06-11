"use client";

import { createContext, useContext, type ReactNode } from "react";

// No entity id in the value, alone among the edit contexts — the profile is a
// patient singleton and the PATCH endpoint is fixed (/api/lifestyle).

interface LifestyleEditValue {
  editing: boolean;
  setEditing: (next: boolean) => void;
}

const LifestyleEditContext = createContext<LifestyleEditValue | null>(null);

export function LifestyleEditProvider({
  value,
  children,
}: {
  value: LifestyleEditValue;
  children: ReactNode;
}) {
  return (
    <LifestyleEditContext.Provider value={value}>
      {children}
    </LifestyleEditContext.Provider>
  );
}

export function useLifestyleEdit(): LifestyleEditValue {
  const ctx = useContext(LifestyleEditContext);
  if (!ctx) {
    throw new Error(
      "useLifestyleEdit must be used inside <LifestyleEditProvider>",
    );
  }
  return ctx;
}

// Optional read — returns null instead of throwing so callers can branch.
export function useMaybeLifestyleEdit(): LifestyleEditValue | null {
  return useContext(LifestyleEditContext);
}
