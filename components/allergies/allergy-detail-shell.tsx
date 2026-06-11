"use client";

import { useCallback, useState, type ReactNode } from "react";

import { AllergyEditProvider } from "@/components/allergies/allergy-edit-context";
import { AllergyLogChangeProvider } from "@/components/allergies/allergy-log-change-context";
import { AllergyLogChangeDialog } from "@/components/allergies/allergy-log-change-dialog";
import type { Allergy } from "@/db/schema";

interface Props {
  allergy: Allergy;
  children: ReactNode;
}

/*
 * Client wrapper around the detail page. Clones condition-detail-shell.tsx:
 * provides the edit context (Edit/Done button lives in the header) and the
 * `+ Log a change` opener; owns the dialog so its open state survives across
 * the header, the Current section's hint, and the History section button.
 *
 * Like Condition, Allergy has no terminal state (resolved can recur, disproved
 * can be re-suspected), so Edit and `+ Log a change` are always available.
 * No doctors prop — allergy changes are status/severity only.
 */
export function AllergyDetailShell({ allergy, children }: Props) {
  const [editing, setEditing] = useState(false);
  const [logChangeOpen, setLogChangeOpen] = useState(false);

  const openLogChange = useCallback(() => setLogChangeOpen(true), []);

  const editProviderValue = {
    editing,
    setEditing,
    allergyId: allergy.id,
  };
  const logChangeProviderValue = { open: openLogChange };

  return (
    <>
      <AllergyEditProvider value={editProviderValue}>
        <AllergyLogChangeProvider value={logChangeProviderValue}>
          {children}
        </AllergyLogChangeProvider>
      </AllergyEditProvider>

      <AllergyLogChangeDialog
        allergyId={allergy.id}
        substance={allergy.substance}
        currentStatus={allergy.status}
        open={logChangeOpen}
        onOpenChange={setLogChangeOpen}
      />
    </>
  );
}
