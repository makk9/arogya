"use client";

import { useCallback, useState, type ReactNode } from "react";

import { DoctorEditProvider } from "@/components/doctors/doctor-edit-context";
import { DoctorLogChangeProvider } from "@/components/doctors/doctor-log-change-context";
import { DoctorLogChangeDialog } from "@/components/doctors/doctor-log-change-dialog";
import type { Doctor } from "@/db/schema";

interface Props {
  doctor: Doctor;
  todayInPatientTz: string;
  children: ReactNode;
}

/*
 * Client wrapper around the detail page. Clones condition-detail-shell.tsx —
 * same two contexts (edit mode + log-change opener), same dialog ownership
 * (its open state must survive across the header, the Current section's hint,
 * and the History section button). No freeze branch: Doctor has no terminal
 * state, so Edit and `+ Log a change` are always available.
 */
export function DoctorDetailShell({
  doctor,
  todayInPatientTz,
  children,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [logChangeOpen, setLogChangeOpen] = useState(false);

  const openLogChange = useCallback(() => setLogChangeOpen(true), []);

  const editProviderValue = {
    editing,
    setEditing,
    doctorId: doctor.id,
  };
  const logChangeProviderValue = { open: openLogChange };

  return (
    <>
      <DoctorEditProvider value={editProviderValue}>
        <DoctorLogChangeProvider value={logChangeProviderValue}>
          {children}
        </DoctorLogChangeProvider>
      </DoctorEditProvider>

      <DoctorLogChangeDialog
        doctorId={doctor.id}
        doctorName={doctor.name}
        todayInPatientTz={todayInPatientTz}
        open={logChangeOpen}
        onOpenChange={setLogChangeOpen}
      />
    </>
  );
}
