"use client";

import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { TypeDeleteDialog } from "@/components/symptoms/type-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  patientId: string;
  typeId: string;
  typeName: string;
  episodeCount: number;
}

/*
 * `…` menu for the SymptomType detail. Single action: Delete (cascade-
 * destructive — warns with the episode count in the dialog).
 */
export function TypeActionsMenu({
  patientId,
  typeId,
  typeName,
  episodeCount,
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
              aria-label="Symptom actions"
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

      <TypeDeleteDialog
        patientId={patientId}
        typeId={typeId}
        typeName={typeName}
        episodeCount={episodeCount}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
