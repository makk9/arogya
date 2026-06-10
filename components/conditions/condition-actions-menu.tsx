"use client";

import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { ConditionDeleteDialog } from "@/components/conditions/condition-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  patientId: string;
  conditionId: string;
  conditionName: string;
}

/*
 * `…` menu per design.md 6.5:1384. Single action: Delete (FK-safe — med.purpose
 * and lab.linkedCondition both onDelete:"set null", so linked rows null their
 * refs rather than blocking). Resolve is reachable via `+ Log a change → status`;
 * Export deferred (as it was for Medication). Clones medication-actions-menu.tsx.
 */
export function ConditionActionsMenu({
  patientId,
  conditionId,
  conditionName,
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
              aria-label="Condition actions"
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

      <ConditionDeleteDialog
        patientId={patientId}
        conditionId={conditionId}
        conditionName={conditionName}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
