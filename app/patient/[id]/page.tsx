import { notFound } from "next/navigation";

import { AskAiButton } from "@/components/ask-ai-button";
import { PatientAtAGlanceSection } from "@/components/patient/patient-at-a-glance-section";
import { PatientDetailHeader } from "@/components/patient/patient-detail-header";
import { PatientDetailShell } from "@/components/patient/patient-detail-shell";
import { PatientIdentitySection } from "@/components/patient/patient-identity-section";
import { PatientMedicalProfileSection } from "@/components/patient/patient-medical-profile-section";
import { PatientNotesSection } from "@/components/patient/patient-notes-section";
import { patientQueries } from "@/db/queries/patient";
import { vitalQueries } from "@/db/queries/vital";
import { READING_TYPE_LABEL } from "@/lib/vitals";
import { getCurrentPatient } from "@/lib/auth";
import { ageInYears, todayInTimezone } from "@/lib/datetime";
import { unitSystemForCountry } from "@/lib/units";

/*
 * Patient profile per design.md 6.10 — the canonical view of the patient as a
 * person, built on the §6.5 state-detail template with patient-specific
 * variations. Sections in order: IDENTITY → MEDICAL PROFILE → AT A GLANCE →
 * NOTES (no CONTACT — deferred for this vertical; no History — identity edits
 * aren't versioned, 6.10:1661).
 *
 * Reached by URL / inter-entity links today; the patient switcher + dashboard
 * header card that 6.10:1652 names as entry points are later surfaces.
 */
export default async function PatientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const current = await getCurrentPatient();
  if (id !== current.patientId) notFound();

  // "Recent visits · N in last 30 days" window, anchored to the patient's
  // local today. Construct the lower bound in UTC from the calendar components
  // so the 30-day subtraction can't shift across a timezone boundary.
  const today = todayInTimezone(current.timezone);
  const [ty, tm, td] = today.split("-").map(Number);
  const visitsSince = new Date(Date.UTC(ty, tm - 1, td - 30))
    .toISOString()
    .slice(0, 10);

  // The row, the glance counts, and the vitals presence are independent — one wave.
  const [patient, counts, vitalTypes] = await Promise.all([
    patientQueries.getById(current.patientId),
    patientQueries.atAGlance(current.patientId, visitsSince, today),
    vitalQueries.typeCounts(current.patientId),
  ]);
  if (!patient) notFound();

  const age = ageInYears(patient.dateOfBirth, today);
  const unitSystem = unitSystemForCountry(patient.country);
  const notesText = patient.notes?.trim() ?? "";

  // AT A GLANCE's vitals row: which vitals are tracked (canonical order),
  // previewed like the entity rows — first two type labels + overflow.
  const vitalsGlance = {
    count: vitalTypes.length,
    names: vitalTypes.slice(0, 2).map((t) => READING_TYPE_LABEL[t.readingType]),
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PatientDetailShell>
        <PatientDetailHeader
          patientId={current.patientId}
          patient={patient}
          relationship={current.relationship}
          age={age}
        />

        <PatientIdentitySection
          patient={patient}
          relationship={current.relationship}
          age={age}
        />

        <PatientMedicalProfileSection
          patientId={current.patientId}
          patient={patient}
          activeAllergies={counts.activeAllergies}
          unitSystem={unitSystem}
        />

        <PatientAtAGlanceSection
          patientId={current.patientId}
          counts={counts}
          vitals={vitalsGlance}
        />

        <PatientNotesSection notes={notesText} />
      </PatientDetailShell>

      <AskAiButton surface={{ key: "patient-profile" }} />
    </main>
  );
}
