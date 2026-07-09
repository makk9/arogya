"use client";

import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { MedicationDeleteDialog } from "@/components/medications/medication-delete-dialog";
import { MedicationDiscontinueDialog } from "@/components/medications/medication-discontinue-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  patientId: string;
  medicationId: string;
  medicationName: string;
  status: string;
}

/*
 * `…` menu per design.md 6.5:1388 ("Discontinue, Resolve, Delete, Export").
 * Discontinue is a logged state change and only applies while the med is active,
 * so it hides once status === "discontinued". Delete removes the record outright
 * and stays available in every state — a discontinued med is exactly what you'd
 * want to remove. Resume (paused → active) is v1.5; Export is deferred.
 */
export function MedicationActionsMenu({
  patientId,
  medicationId,
  medicationName,
  status,
}: Props) {
  const [discontinueOpen, setDiscontinueOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const canDiscontinue = status !== "discontinued";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Medication actions"
            >
              <MoreHorizontal />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {canDiscontinue ? (
            <DropdownMenuItem onClick={() => setDiscontinueOpen(true)}>
              Discontinue
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <MedicationDiscontinueDialog
        medicationId={medicationId}
        medicationName={medicationName}
        open={discontinueOpen}
        onOpenChange={setDiscontinueOpen}
      />

      <MedicationDeleteDialog
        patientId={patientId}
        medicationId={medicationId}
        medicationName={medicationName}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
