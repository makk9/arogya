"use client";

import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { AllergyDeleteDialog } from "@/components/allergies/allergy-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  patientId: string;
  allergyId: string;
  substance: string;
}

/*
 * `…` menu per design.md 6.5:1384. Single action: Delete (trivially FK-safe —
 * nothing references allergies except its own change log, which cascades).
 * Resolve/Disprove are reachable via `+ Log a change → status`; Export
 * deferred. Clones condition-actions-menu.tsx.
 */
export function AllergyActionsMenu({ patientId, allergyId, substance }: Props) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Allergy actions"
            >
              <MoreHorizontal />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AllergyDeleteDialog
        patientId={patientId}
        allergyId={allergyId}
        substance={substance}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
