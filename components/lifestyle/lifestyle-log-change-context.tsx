"use client";

import { createContext, useContext, type ReactNode } from "react";

// Two consumers (History section's `+ Log a change` button + Current section's
// in-edit-mode hint) need to open the same dialog the shell owns. Mirrors
// allergy-log-change-context.tsx.

interface LifestyleLogChangeValue {
  open: () => void;
}

const LifestyleLogChangeContext =
  createContext<LifestyleLogChangeValue | null>(null);

export function LifestyleLogChangeProvider({
  value,
  children,
}: {
  value: LifestyleLogChangeValue;
  children: ReactNode;
}) {
  return (
    <LifestyleLogChangeContext.Provider value={value}>
      {children}
    </LifestyleLogChangeContext.Provider>
  );
}

export function useMaybeLifestyleLogChange(): LifestyleLogChangeValue | null {
  return useContext(LifestyleLogChangeContext);
}
