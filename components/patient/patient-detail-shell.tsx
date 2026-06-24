"use client";

import { useState, type ReactNode } from "react";

import { PatientEditProvider } from "@/components/patient/patient-edit-context";

/*
 * Client wrapper around the patient profile page. Provides PatientEditContext
 * (editing + setEditing); the Edit/Done button lives in the header (anchored
 * to the H1 row per §6.5 page shell) and reads setEditing from context.
 *
 * Unlike MedicationDetailShell there is no log-change context — the patient
 * root has no change log (§6.10: identity edits aren't versioned), so every
 * field edits in place via InlineField.
 */
export function PatientDetailShell({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState(false);

  return (
    <PatientEditProvider value={{ editing, setEditing }}>
      {children}
    </PatientEditProvider>
  );
}
