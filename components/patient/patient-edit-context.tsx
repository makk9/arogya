"use client";

import { createContext, useContext, type ReactNode } from "react";

interface PatientEditValue {
  editing: boolean;
  setEditing: (next: boolean) => void;
}

const PatientEditContext = createContext<PatientEditValue | null>(null);

export function PatientEditProvider({
  value,
  children,
}: {
  value: PatientEditValue;
  children: ReactNode;
}) {
  return (
    <PatientEditContext.Provider value={value}>
      {children}
    </PatientEditContext.Provider>
  );
}

// Optional read — sections call this so they render fine outside a provider
// too. Returns null instead of throwing, matching useMaybeMedicationEdit. No
// patientId is threaded through: the PATCH route is the singleton /api/patient
// (auth-derived), so InlineField needs no id from context.
export function useMaybePatientEdit(): PatientEditValue | null {
  return useContext(PatientEditContext);
}
