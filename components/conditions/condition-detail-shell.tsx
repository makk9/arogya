"use client";

import { useCallback, useState, type ReactNode } from "react";

import { ConditionEditProvider } from "@/components/conditions/condition-edit-context";
import { ConditionLogChangeProvider } from "@/components/conditions/condition-log-change-context";
import {
  ConditionLogChangeDialog,
  type DoctorOption,
} from "@/components/conditions/condition-log-change-dialog";
import type { Condition } from "@/db/schema";
import type { ConditionChangeFormValues } from "@/lib/schemas/forms/condition";

interface Props {
  condition: Condition;
  doctors: ReadonlyArray<DoctorOption>;
  children: ReactNode;
}

/*
 * Client wrapper around the detail page. Provides two contexts:
 *  - ConditionEditContext carries `editing` + `setEditing` + `conditionId`.
 *    The Edit/Done button lives in the header (anchored to the H1 row per
 *    §6.5 page shell), not here — header reads setEditing from context.
 *  - ConditionLogChangeContext exposes the `+ Log a change` dialog opener.
 *
 * The dialog itself is owned here because its open state needs to survive across
 * the header, the Current section's hint, and the History section button.
 *
 * Clones medication-detail-shell.tsx MINUS the discontinued-freeze branch:
 * Condition has no terminal state (resolved → active is permitted), so Edit and
 * `+ Log a change` are always available regardless of status.
 */
export function ConditionDetailShell({ condition, doctors, children }: Props) {
  const [editing, setEditing] = useState(false);
  const [logChangeOpen, setLogChangeOpen] = useState(false);
  // `open(field)` preselects that field in the dialog; the dialog is keyed
  // per open so each launch mounts fresh with the right defaults.
  const [initialField, setInitialField] = useState<
    ConditionChangeFormValues["field"] | null
  >(null);
  const [dialogKey, setDialogKey] = useState(0);

  const openLogChange = useCallback(
    (field?: ConditionChangeFormValues["field"]) => {
      setInitialField(field ?? null);
      setDialogKey((k) => k + 1);
      setLogChangeOpen(true);
    },
    [],
  );

  const editProviderValue = {
    editing,
    setEditing,
    conditionId: condition.id,
  };
  const logChangeProviderValue = { open: openLogChange };

  return (
    <>
      <ConditionEditProvider value={editProviderValue}>
        <ConditionLogChangeProvider value={logChangeProviderValue}>
          {children}
        </ConditionLogChangeProvider>
      </ConditionEditProvider>

      <ConditionLogChangeDialog
        key={dialogKey}
        initialField={initialField}
        conditionId={condition.id}
        conditionName={condition.name}
        doctors={doctors}
        currentStatus={condition.status}
        currentManagingDoctorId={condition.managingDoctor}
        open={logChangeOpen}
        onOpenChange={setLogChangeOpen}
      />
    </>
  );
}
