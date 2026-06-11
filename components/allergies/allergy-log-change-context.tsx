"use client";

import { createContext, useContext, type ReactNode } from "react";

// Two consumers (History section's `+ Log a change` button + Current section's
// in-edit-mode hint) need to open the same dialog the shell owns. Mirrors
// condition-log-change-context.tsx.

interface AllergyLogChangeValue {
  open: () => void;
}

const AllergyLogChangeContext = createContext<AllergyLogChangeValue | null>(
  null,
);

export function AllergyLogChangeProvider({
  value,
  children,
}: {
  value: AllergyLogChangeValue;
  children: ReactNode;
}) {
  return (
    <AllergyLogChangeContext.Provider value={value}>
      {children}
    </AllergyLogChangeContext.Provider>
  );
}

export function useMaybeAllergyLogChange(): AllergyLogChangeValue | null {
  return useContext(AllergyLogChangeContext);
}
