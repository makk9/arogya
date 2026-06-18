"use client";

import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { JournalDeleteDialog } from "@/components/journal/journal-delete-dialog";
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
  entryLabel: string;
}

/*
 * `…` menu per design.md 6.7:1554. Single action: Delete (nothing references a
 * journal entry, so the delete is unconditional — no FK detach/restrict). Export
 * source / Discard don't apply to a typed entry.
 */
export function JournalActionsMenu({ patientId, entryId, entryLabel }: Props) {
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
              aria-label="Entry actions"
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

      <JournalDeleteDialog
        patientId={patientId}
        entryId={entryId}
        entryLabel={entryLabel}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
