"use client";

import { PatientAvatar } from "@/components/patient/patient-avatar";
import { useMaybePatientEdit } from "@/components/patient/patient-edit-context";
import { PatientInlineField } from "@/components/patient/patient-inline-field";
import { PatientActionsMenu } from "@/components/patient/patient-actions-menu";
import { Button } from "@/components/ui/button";
import type { Patient } from "@/db/schema";

interface Props {
  patientId: string;
  patient: Patient;
  // Resolved label from getCurrentPatient() — the user↔patient relationship,
  // not a patients column (see lib/auth.ts). Read-only in the profile.
  relationship: string;
  // Whole-year age (design.md 6.10:1671); null only for an implausible future
  // DOB, in which case it's dropped from the subtitle.
  age: number | null;
}

/*
 * Patient profile header per design.md 6.10:1667. Breadcrumb → avatar + name
 * (red underline accent) on the left, Edit/Done + `…` menu on the right.
 * Subtitle: `[age] · [sex] · [relationship] · [location]` with compact
 * abbreviations (1671). In edit mode the H1 swaps to name + preferred-name
 * inputs and the derived subtitle hides — the demographics it summarizes
 * become editable in the IDENTITY section below.
 */

// Compact sex abbreviations per 6.10:1671 ("M for Male"). intersex/unspecified
// have no conventional single letter, so they fall back to a short label.
const SEX_ABBREV: Record<Patient["sex"], string> = {
  male: "M",
  female: "F",
  intersex: "Intersex",
  unspecified: "Unspecified",
};

export function PatientDetailHeader({
  patientId,
  patient,
  relationship,
  age,
}: Props) {
  const editCtx = useMaybePatientEdit();
  const editing = editCtx?.editing ?? false;
  const setEditing = editCtx?.setEditing ?? (() => {});

  const location = [patient.city, patient.country].filter(Boolean).join(", ");
  const subtitleParts = [
    age != null ? String(age) : null,
    SEX_ABBREV[patient.sex],
    relationship,
    location || null,
  ].filter((p): p is string => Boolean(p));

  return (
    <>
      <nav
        aria-label="breadcrumb"
        className="mb-6 font-mono text-xs text-muted-foreground"
      >
        / patient / {patientId.slice(0, 8)}…
      </nav>

      <div className="mb-2 flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <PatientAvatar
            name={patient.name}
            photoUrl={patient.photoUrl}
            editing={editing}
          />
          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <PatientInlineField
                  fieldKey="name"
                  value={patient.name}
                  variant="text"
                  required
                  clearable={false}
                  ariaLabel="Name"
                  displayValue={patient.name}
                />
                <PatientInlineField
                  fieldKey="preferredName"
                  value={patient.preferredName}
                  variant="text"
                  required={false}
                  clearable
                  ariaLabel="Preferred name"
                  placeholder="Preferred name (e.g. Appa)"
                  displayValue={patient.preferredName ?? "—"}
                />
              </div>
            ) : (
              <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-heading text-2xl font-semibold leading-tight">
                <span className="border-b-2 border-destructive pb-1">
                  {patient.name}
                </span>
                {patient.preferredName ? (
                  <span className="text-base font-normal text-muted-foreground">
                    “{patient.preferredName}”
                  </span>
                ) : null}
              </h1>
            )}
          </div>
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
          <PatientActionsMenu />
        </div>
      </div>

      {!editing && subtitleParts.length > 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {subtitleParts.join(" · ")}
        </p>
      ) : null}
    </>
  );
}
