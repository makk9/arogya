"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { AllergyChangeFormValues } from "@/lib/schemas/forms/allergy";

// Consumers (History section's `+ Log a change` button + Current section's
// clickable value cards) need to open the same dialog the shell owns. Passing
// a field preselects it in the dialog — the click-where-the-data-is entry
// point (decisions.md 2026-08-12). Mirrors condition-log-change-context.tsx.

interface AllergyLogChangeValue {
  open: (field?: AllergyChangeFormValues["field"]) => void;
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
