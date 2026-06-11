"use client";

import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { FamilyHistoryDeleteDialog } from "@/components/family-history/family-history-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  patientId: string;
  entryId: string;
  /** Display name for the confirm dialog ("Father — Heart attack"). */
  displayName: string;
}

/*
 * `…` menu per design.md 6.5:1384. Single action: Delete (trivially FK-safe —
 * nothing references family_history; there isn't even a change log to
 * cascade). No state transitions to offer: FamilyHistory has no status.
 * Clones allergy-actions-menu.tsx.
 */
export function FamilyHistoryActionsMenu({
  patientId,
  entryId,
  displayName,
}: Props) {
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
              aria-label="Family history actions"
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

      <FamilyHistoryDeleteDialog
        patientId={patientId}
        entryId={entryId}
        displayName={displayName}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
