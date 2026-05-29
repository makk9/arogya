"use client";

import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { MedicationDiscontinueDialog } from "@/components/medications/medication-discontinue-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  medicationId: string;
  medicationName: string;
}

/*
 * `…` menu per design.md 6.5:1384. Item 4 scope: Discontinue only. Item 5
 * adds Edit / Delete / Export. Page omits this entire component when
 * status === "discontinued" (locked refinement) — no need to ship a menu
 * that does nothing useful.
 */
export function MedicationActionsMenu({ medicationId, medicationName }: Props) {
  const [discontinueOpen, setDiscontinueOpen] = useState(false);

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
          <DropdownMenuItem onClick={() => setDiscontinueOpen(true)}>
            Discontinue
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <MedicationDiscontinueDialog
        medicationId={medicationId}
        medicationName={medicationName}
        open={discontinueOpen}
        onOpenChange={setDiscontinueOpen}
      />
    </>
  );
}
