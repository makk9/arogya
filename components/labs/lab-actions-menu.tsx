"use client";

import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { LabDeleteDialog } from "@/components/labs/lab-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/*
 * `…` menu per design.md 6.7:1554. Single action in v1: Delete (cascades the
 * report's markers). Export source deferred with the extraction pipeline
 * (Phase E — there's no source PDF stored until then).
 */
interface Props {
  patientId: string;
  reportId: string;
  reportLabel: string;
  markerCount: number;
}

export function LabActionsMenu({
  patientId,
  reportId,
  reportLabel,
  markerCount,
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
              aria-label="Lab report actions"
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

      <LabDeleteDialog
        patientId={patientId}
        reportId={reportId}
        reportLabel={reportLabel}
        markerCount={markerCount}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
