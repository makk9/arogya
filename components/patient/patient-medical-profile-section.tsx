"use client";

import Link from "next/link";

import { PatientInlineField } from "@/components/patient/patient-inline-field";
import { PatientMeasurementField } from "@/components/patient/patient-measurement-field";
import type { Patient } from "@/db/schema";
import type { UnitSystem } from "@/lib/units";

interface Props {
  patientId: string;
  patient: Patient;
  activeAllergies: number;
  // Display/input unit system, derived from patient.country server-side.
  unitSystem: UnitSystem;
}

/*
 * MEDICAL PROFILE section per design.md 6.10:1678 — blood type, height,
 * weight, and an allergies summary count linking to the Allergies list
 * (`N list →`, the count-summary navigation pattern from 1695).
 *
 * Allergies live HERE, not in AT A GLANCE: §6.10 lists them in both, but
 * that reads as redundant on screen, so allergies sit with blood type as the
 * safety-critical "emergency card" pair and were dropped from the AT A GLANCE
 * index (user decision 2026-06-18, decisions.md).
 *
 * Height/weight render + edit in the patient's country-derived units (cm/kg
 * for the India demo, ft-in/lb for a US patient) via PatientMeasurementField;
 * the schema stores canonical metric and conversion happens at the input edge
 * (lib/units.ts).
 *
 * This section is FACTS ONLY — vitals-history navigation lived here briefly
 * (as §6.10:1678's weight-attached `history →`, then as its own cell) but a
 * nav link has no fact to state, so no wording ever fit; it now lives in AT A
 * GLANCE, the profile's navigation index (user findings 2026-08-12 ×3).
 * Allergies stays because its count IS the fact. Weight remains the patient
 * row's `current_weight_kg` snapshot; the inline trend stays on the
 * dashboard's key-markers card.
 */

const SECTION_HEAD =
  "mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground";
const FIELD_LABEL =
  "mb-1 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground";
const DASH = <span className="text-muted-foreground">—</span>;

export function PatientMedicalProfileSection({
  patientId,
  patient,
  activeAllergies,
  unitSystem,
}: Props) {
  return (
    <section className="mb-8">
      <h2 className={SECTION_HEAD}>Medical profile</h2>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted/40 px-4 py-3 md:grid-cols-4">
        <div>
          <div className={FIELD_LABEL}>blood type</div>
          <PatientInlineField
            fieldKey="bloodType"
            value={patient.bloodType}
            variant="select-blood-type"
            required={false}
            // A Select commits a chosen value and has no empty option, so it
            // can't clear back to null — `clearable` would be a no-op here.
            // Blood type changes by re-selecting; clearing it is deferred.
            clearable={false}
            ariaLabel="Blood type"
            placeholder="—"
            displayValue={
              <span className="text-sm">{patient.bloodType ?? DASH}</span>
            }
          />
        </div>
        <div>
          <div className={FIELD_LABEL}>height</div>
          <PatientMeasurementField
            kind="height"
            valueMetric={patient.heightCm}
            system={unitSystem}
            ariaLabel="Height"
          />
        </div>
        <div>
          <div className={FIELD_LABEL}>weight</div>
          <PatientMeasurementField
            kind="weight"
            valueMetric={patient.currentWeightKg}
            system={unitSystem}
            ariaLabel="Weight"
          />
        </div>
        <div>
          <div className={FIELD_LABEL}>allergies</div>
          <Link
            href={`/patient/${patientId}/allergies`}
            className="text-sm underline-offset-4 hover:underline"
          >
            {activeAllergies > 0
              ? `${activeAllergies} list →`
              : "None · view →"}
          </Link>
        </div>
      </div>
    </section>
  );
}
