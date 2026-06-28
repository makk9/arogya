import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/breadcrumb";
import { FamilyHistoryForm } from "@/components/family-history/family-history-form";
import { getCurrentPatient } from "@/lib/auth";

// Server component. Resolves auth + patient scope, then renders the Add
// Family history form. No date fields at all — onset is an age, not a date.

export default async function NewFamilyHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Breadcrumb patientId={id} trail={[{ label: "family-history", href: "family-history" }, { label: "new" }]} />
      <FamilyHistoryForm patientId={patient.patientId} />
    </main>
  );
}
