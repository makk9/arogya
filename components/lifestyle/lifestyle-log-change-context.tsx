"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { LifestyleTrendFieldKey } from "@/components/lifestyle/lifestyle-options";

// Consumers (History section's `+ Log a change` button + the Current section's
// clickable value boxes) need to open the same dialog the shell owns. Passing
// a field preselects it in the dialog — the click-where-the-data-is entry
// point; omitting it starts from the default selector state. Mirrors
// allergy-log-change-context.tsx.

interface LifestyleLogChangeValue {
  open: (field?: LifestyleTrendFieldKey) => void;
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
