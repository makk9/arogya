"use client";

import { createContext, useContext, type ReactNode } from "react";

// Two consumers (History section's `+ Log a change` button + Current
// section's in-edit-mode hint) need to open the same dialog the shell owns.
// Cheaper than prop-drilling through three components; smaller than wiring
// the open state into MedicationEditContext (those concerns are unrelated).

interface MedicationLogChangeValue {
  open: () => void;
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
