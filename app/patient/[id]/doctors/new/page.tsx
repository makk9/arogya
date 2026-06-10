import { notFound } from "next/navigation";

import { DoctorForm } from "@/components/doctors/doctor-form";
import { getCurrentPatient } from "@/lib/auth";

// Server component. Resolves auth + patient scope, then renders the Add Doctor
// form. No date plumbing — the First-visit field has no today-default (first
// visits to long-standing doctors are historical or unknown; see design.md 6.12).

export default async function NewDoctorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <nav
        aria-label="breadcrumb"
        className="mb-6 font-mono text-xs text-muted-foreground"
      >
        / patient / {id.slice(0, 8)}… / doctors / new
      </nav>
      <DoctorForm patientId={patient.patientId} />
    </main>
  );
}
