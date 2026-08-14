"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { MedicationChangeFormValues } from "@/lib/schemas/forms/medication";

// Consumers (History section's `+ Log a change` button + Current section's
// clickable value cards) need to open the same dialog the shell owns.
// Passing a field preselects it in the dialog — the click-where-the-data-is
// entry point (decisions.md 2026-08-12); omitting it starts from the default
// selector state. Cheaper than prop-drilling through three components;
// smaller than wiring the open state into MedicationEditContext (those
// concerns are unrelated).

interface MedicationLogChangeValue {
  open: (field?: MedicationChangeFormValues["field"]) => void;
}

const MedicationLogChangeContext =
  createContext<MedicationLogChangeValue | null>(null);

export function MedicationLogChangeProvider({
  value,
  children,
}: {
  value: MedicationLogChangeValue;
  children: ReactNode;
}) {
  return (
    <MedicationLogChangeContext.Provider value={value}>
      {children}
    </MedicationLogChangeContext.Provider>
  );
}

// Optional read — returns null when the shell omits the provider (e.g.
// status === "discontinued"). Consumers branch on null to hide their
// affordance.
export function useMaybeMedicationLogChange(): MedicationLogChangeValue | null {
  return useContext(MedicationLogChangeContext);
}
