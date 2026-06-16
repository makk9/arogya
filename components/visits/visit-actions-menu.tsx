"use client";

import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { VisitDeleteDialog } from "@/components/visits/visit-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  patientId: string;
  visitId: string;
  visitLabel: string;
  outcomeCount: number;
}

/*
 * `…` menu per design.md 6.7:1530. Single action: Delete (FK-safe — every
 * backlink to a visit is onDelete:"set null"; only doctors restrict, and
 * that's the other direction). Export source deferred with the extraction
 * pipeline (Phase E).
 */
export function VisitActionsMenu({
  patientId,
  visitId,
  visitLabel,
  outcomeCount,
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
              aria-label="Visit actions"
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

      <VisitDeleteDialog
        patientId={patientId}
        visitId={visitId}
        visitLabel={visitLabel}
        outcomeCount={outcomeCount}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
