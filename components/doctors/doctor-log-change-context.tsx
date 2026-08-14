"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { DoctorChangeFormValues } from "@/lib/schemas/forms/doctor";

// Consumers (History section's `+ Log a change` button + Current section's
// clickable value cards) need to open the same dialog the shell owns. Passing
// a field preselects it in the dialog — the click-where-the-data-is entry
// point (decisions.md 2026-08-12). Same shape as the Condition sibling.

interface DoctorLogChangeValue {
  open: (field?: DoctorChangeFormValues["field"]) => void;
}

const DoctorLogChangeContext = createContext<DoctorLogChangeValue | null>(null);

export function DoctorLogChangeProvider({
  value,
  children,
}: {
  value: DoctorLogChangeValue;
  children: ReactNode;
}) {
  return (
    <DoctorLogChangeContext.Provider value={value}>
      {children}
    </DoctorLogChangeContext.Provider>
  );
}

export function useMaybeDoctorLogChange(): DoctorLogChangeValue | null {
  return useContext(DoctorLogChangeContext);
}
