import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/breadcrumb";
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
      <Breadcrumb patientId={id} trail={[{ label: "doctors", href: "doctors" }, { label: "new" }]} />
      <DoctorForm patientId={patient.patientId} />
    </main>
  );
}
