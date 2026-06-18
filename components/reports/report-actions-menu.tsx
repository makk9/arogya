"use client";

import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { ReportDeleteDialog } from "@/components/reports/report-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  patientId: string;
  reportId: string;
  reportLabel: string;
  outcomeCount: number;
}

/*
 * `…` menu per design.md 6.7:1554. Single action: Delete (FK-safe — derived
 * entities reference a report via source_report_id, onDelete:"set null"). Export
 * source deferred with the upload/extraction pipeline (Phase E).
 */
export function ReportActionsMenu({
  patientId,
  reportId,
  reportLabel,
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
              aria-label="Report actions"
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

      <ReportDeleteDialog
        patientId={patientId}
        reportId={reportId}
        reportLabel={reportLabel}
        outcomeCount={outcomeCount}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
