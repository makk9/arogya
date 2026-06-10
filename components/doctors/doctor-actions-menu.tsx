"use client";

import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { DoctorDeleteDialog } from "@/components/doctors/doctor-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  patientId: string;
  doctorId: string;
  doctorName: string;
}

/*
 * `…` menu per design.md 6.5:1384. Single action: Delete. Doctor has no state
 * transitions (no Discontinue/Resolve equivalent); Export deferred as on the
 * other entities. Deletion can be refused server-side when visits reference
 * this doctor (restrict FK) — the dialog surfaces that 409.
 */
export function DoctorActionsMenu({ patientId, doctorId, doctorName }: Props) {
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
              aria-label="Doctor actions"
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

      <DoctorDeleteDialog
        patientId={patientId}
        doctorId={doctorId}
        doctorName={doctorName}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
