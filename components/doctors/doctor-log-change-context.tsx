"use client";

import { createContext, useContext, type ReactNode } from "react";

// Two consumers (History section's `+ Log a change` button + Current section's
// in-edit-mode hint) need to open the same dialog the shell owns. Same shape as
// the Condition sibling.

interface DoctorLogChangeValue {
  open: () => void;
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
