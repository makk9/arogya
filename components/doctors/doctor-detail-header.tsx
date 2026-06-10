"use client";

import type { ReactNode } from "react";

import { DoctorInlineField } from "@/components/doctors/doctor-inline-field";
import { useMaybeDoctorEdit } from "@/components/doctors/doctor-edit-context";
import { Button } from "@/components/ui/button";
import type { Doctor } from "@/db/schema";
import { displayDoctorName } from "@/lib/doctor-display";

interface Props {
  patientId: string;
  doctor: Doctor;
  // Slot for the `…` menu.
  actionsSlot: ReactNode | null;
}

/*
 * Detail header per design.md §6.5 page shell. Clones condition-detail-header.
 *
 * Doctor has no status, so the title-row pill carries the specialty instead —
 * §6.5's deferred-polish note calls this mildly redundant with the Current
 * section but keeps it ("helps when the Current section scrolls off-screen").
 * Subtitle is the clinic (light context). Edit + `…` are always available.
 */
export function DoctorDetailHeader({ patientId, doctor, actionsSlot }: Props) {
  const editCtx = useMaybeDoctorEdit();
  const editing = editCtx?.editing ?? false;
  const setEditing = editCtx?.setEditing ?? (() => {});

  return (
    <>
      <nav
        aria-label="breadcrumb"
        className="mb-6 font-mono text-xs text-muted-foreground"
      >
        / patient / {patientId.slice(0, 8)}… / doctors / {doctor.id.slice(0, 8)}…
      </nav>

      <div className="mb-2 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-col gap-3">
              <DoctorInlineField
                fieldKey="name"
                value={doctor.name}
                variant="text"
                required
                clearable={false}
                ariaLabel="Name"
                displayValue={displayDoctorName(doctor.name)}
              />
              <span className="inline-flex w-fit items-baseline rounded-full border border-border bg-muted px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                {doctor.specialty}
              </span>
            </div>
          ) : (
            <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-heading text-2xl font-semibold leading-tight">
              <span className="border-b-2 border-destructive pb-1">
                {displayDoctorName(doctor.name)}
              </span>
              <span className="inline-flex items-baseline rounded-full border border-border bg-muted px-2 py-0.5 text-[0.55em] font-medium uppercase tracking-wide text-muted-foreground">
                {doctor.specialty}
              </span>
            </h1>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant={editing ? "default" : "outline"}
            size="sm"
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Done" : "Edit"}
          </Button>
          {actionsSlot}
        </div>
      </div>

      {!editing && doctor.clinic ? (
        <p className="mt-2 text-sm text-muted-foreground">{doctor.clinic}</p>
      ) : null}
    </>
  );
}
