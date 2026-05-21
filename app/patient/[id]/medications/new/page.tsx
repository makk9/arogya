import { notFound } from "next/navigation";

import { MedicationForm } from "@/components/medications/medication-form";
import { getCurrentPatient } from "@/lib/auth";
import { todayInTimezone } from "@/lib/datetime";

// Server component. Resolves auth + patient timezone, then hands the form a
// `todayInPatientTz` string so the StartedOn field defaults to the patient's
// local date (per design.md 9.6:2803 — the patient's IANA tz is canonical for
// date-only fields, not the user's browser tz).

export default async function NewMedicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  const todayInPatientTz = todayInTimezone(patient.timezone);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {/*
        Breadcrumb shape per design.md 6.12:1833 (`/ patient / [id] / medications / new`).
        Patient ID truncated to first 8 chars + ellipsis — full UUIDs are visually noisy
        in stub-auth state, and the route segment is unambiguous from context. When
        Phase 6.10 (patient profile) ships a friendly slug, this becomes a name.
      */}
      <nav
        aria-label="breadcrumb"
        className="mb-6 font-mono text-xs text-muted-foreground"
      >
        / patient / {id.slice(0, 8)}… / medications / new
      </nav>
      <MedicationForm
        patientId={patient.patientId}
        todayInPatientTz={todayInPatientTz}
      />
    </main>
  );
}
