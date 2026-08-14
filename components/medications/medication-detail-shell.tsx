"use client";

import { useCallback, useState, type ReactNode } from "react";

import { MedicationEditProvider } from "@/components/medications/medication-edit-context";
import { MedicationLogChangeProvider } from "@/components/medications/medication-log-change-context";
import {
  MedicationLogChangeDialog,
  type DoctorOption,
  type VisitOption,
} from "@/components/medications/medication-log-change-dialog";
import type { Medication } from "@/db/schema";
import type { MedicationChangeFormValues } from "@/lib/schemas/forms/medication";

interface Props {
  medication: Medication;
  doctors: ReadonlyArray<DoctorOption>;
  visits: ReadonlyArray<VisitOption>;
  children: ReactNode;
}

/*
 * Client wrapper around the detail page. Provides two contexts:
 *  - MedicationEditContext carries `editing` + `setEditing` + `medicationId`.
 *    The Edit/Done button lives in the header (anchored to the H1 row per
 *    §6.5 page shell), not here — header reads setEditing from context.
 *  - MedicationLogChangeContext exposes the `+ Log a change` dialog opener.
 *
 * The dialog itself is owned here because its open state needs to survive
 * across the header and the History section button.
 *
 * Both contexts are omitted on discontinued meds so the corresponding
 * affordances (Edit button, History `+ Log a change` button, in-edit-mode
 * hint) disappear without each component needing its own status check.
 */
export function MedicationDetailShell({
  medication,
  doctors,
  visits,
  children,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [logChangeOpen, setLogChangeOpen] = useState(false);
  // `open(field)` preselects that field in the dialog; the dialog is keyed
  // per open so each launch mounts fresh with the right defaults.
  const [initialField, setInitialField] = useState<
    MedicationChangeFormValues["field"] | null
  >(null);
  const [dialogKey, setDialogKey] = useState(0);

  const openLogChange = useCallback(
    (field?: MedicationChangeFormValues["field"]) => {
      setInitialField(field ?? null);
      setDialogKey((k) => k + 1);
      setLogChangeOpen(true);
    },
    [],
  );

  const isDiscontinued = medication.status === "discontinued";
  const showLogChange = !isDiscontinued;

  // Discontinued meds collapse Edit by emitting an EditProvider whose
  // setEditing is a no-op AND a frozen editing=false. Header still reads the
  // value (no crash) but won't render the Edit button.
  const editProviderValue = isDiscontinued
    ? {
        editing: false,
        setEditing: () => {},
        medicationId: medication.id,
        locked: true,
      }
    : { editing, setEditing, medicationId: medication.id, locked: false };

  const logChangeProviderValue = { open: openLogChange };

  const tree = (
    <MedicationEditProvider value={editProviderValue}>
      {children}
    </MedicationEditProvider>
  );

  return (
    <>
      {showLogChange ? (
        <MedicationLogChangeProvider value={logChangeProviderValue}>
          {tree}
        </MedicationLogChangeProvider>
      ) : (
        tree
      )}

      {showLogChange ? (
        <MedicationLogChangeDialog
          key={dialogKey}
          initialField={initialField}
          medicationId={medication.id}
          medicationName={medication.name}
          doctors={doctors}
          visits={visits}
          currentStatus={medication.status}
          currentPrescribingDoctorId={medication.prescribingDoctor}
          open={logChangeOpen}
          onOpenChange={setLogChangeOpen}
        />
      ) : null}
    </>
  );
}
