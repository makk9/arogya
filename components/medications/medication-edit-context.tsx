"use client";

import { createContext, useContext, type ReactNode } from "react";

interface MedicationEditValue {
  editing: boolean;
  setEditing: (next: boolean) => void;
  medicationId: string;
}

const MedicationEditContext = createContext<MedicationEditValue | null>(null);

export function MedicationEditProvider({
  value,
  children,
}: {
  value: MedicationEditValue;
  children: ReactNode;
}) {
  return (
    <MedicationEditContext.Provider value={value}>
      {children}
    </MedicationEditContext.Provider>
  );
}

export function useMedicationEdit(): MedicationEditValue {
  const ctx = useContext(MedicationEditContext);
  if (!ctx) {
    throw new Error(
      "useMedicationEdit must be used inside <MedicationEditProvider>",
    );
  }
  return ctx;
}

// Optional read — InlineField needs this when used outside a provider (the
// add-medication form, future surfaces). Returns null instead of throwing so
// callers can branch.
export function useMaybeMedicationEdit(): MedicationEditValue | null {
  return useContext(MedicationEditContext);
}
