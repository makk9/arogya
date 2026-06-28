import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/breadcrumb";
import { MedicationForm } from "@/components/medications/medication-form";
import { getCurrentPatient } from "@/lib/auth";

// Server component. Resolves auth + patient scope, then renders the Add
// Medication form. The StartedOn today-default is computed in the form itself
// (browser-local per decisions.md 2026-06-10) — no timezone plumbing here.

export default async function NewMedicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {/*
        Breadcrumb shape per design.md 6.12:1833 (`/ patient / [id] / medications / new`).
        Patient ID truncated to first 8 chars + ellipsis — full UUIDs are visually noisy
        in stub-auth state, and the route segment is unambiguous from context. When
        Phase 6.10 (patient profile) ships a friendly slug, this becomes a name.
      */}
      <Breadcrumb patientId={id} trail={[{ label: "medications", href: "medications" }, { label: "new" }]} />
      <MedicationForm patientId={patient.patientId} />
    </main>
  );
}
