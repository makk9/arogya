"use client";

import { useMaybePatientEdit } from "@/components/patient/patient-edit-context";
import { PatientInlineField } from "@/components/patient/patient-inline-field";
import type { Patient } from "@/db/schema";
import { formatAbsoluteDate } from "@/lib/datetime";

interface Props {
  patient: Patient;
  relationship: string;
  age: number | null;
}

/*
 * IDENTITY section per design.md 6.10:1677 — mixed-density per the §6.5
 * template (1380): the two key demographics (age, sex) prominent in tinted
 * cards, secondary fields (DOB, relationship, location) in a compact tinted
 * grid below.
 *
 * Deviations, both intentional:
 *  - Name is edited in the header (H1), not repeated as a prominent IDENTITY
 *    field — showing the name twice on one screen reads as a bug. Matches how
 *    the Medication header owns name editing.
 *  - "Primary language" is omitted (no backing column; deferred for this
 *    vertical — see decisions.md).
 *
 * Age is derived from DOB, so it's display-only here; editing the DOB field in
 * the grid updates the age card on the next render. Relationship is read-only
 * (it's stub auth identity, not a patients column).
 */

const SECTION_HEAD =
  "mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground";
const FIELD_LABEL =
  "mb-1 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

const SEX_LABEL: Record<Patient["sex"], string> = {
  male: "Male",
  female: "Female",
  intersex: "Intersex",
  unspecified: "Unspecified",
};

export function PatientIdentitySection({ patient, relationship, age }: Props) {
  const editing = useMaybePatientEdit()?.editing ?? false;
  const location = [patient.city, patient.country].filter(Boolean).join(", ");

  return (
    <section className="mb-8">
      <h2 className={SECTION_HEAD}>Identity</h2>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-2xl font-semibold leading-tight">
            {age != null ? age : "—"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">age</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <PatientInlineField
            fieldKey="sex"
            value={patient.sex}
            variant="select-sex"
            required
            clearable={false}
            ariaLabel="Sex"
            displayValue={
              <div className="text-2xl font-semibold leading-tight">
                {SEX_LABEL[patient.sex]}
              </div>
            }
          />
          <div className="mt-1 text-xs text-muted-foreground">sex</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted/40 px-4 py-3 md:grid-cols-3">
        <div>
          <div className={FIELD_LABEL}>date of birth</div>
          <PatientInlineField
            fieldKey="dateOfBirth"
            value={patient.dateOfBirth}
            variant="date"
            required
            clearable={false}
            ariaLabel="Date of birth"
            displayValue={
              <span className="text-sm">
                {formatAbsoluteDate(patient.dateOfBirth)}
              </span>
            }
          />
        </div>
        <div>
          <div className={FIELD_LABEL}>relationship</div>
          <div className="text-sm">{relationship}</div>
        </div>
        <div>
          <div className={FIELD_LABEL}>location</div>
          {editing ? (
            <div className="flex flex-col gap-2">
              <PatientInlineField
                fieldKey="city"
                value={patient.city}
                variant="text"
                required={false}
                clearable
                ariaLabel="City"
                placeholder="City"
                displayValue={null}
              />
              <PatientInlineField
                fieldKey="country"
                value={patient.country}
                variant="text"
                required
                clearable={false}
                ariaLabel="Country"
                placeholder="Country"
                displayValue={null}
              />
            </div>
          ) : (
            <span className="text-sm">
              {location || <span className="text-muted-foreground">—</span>}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
