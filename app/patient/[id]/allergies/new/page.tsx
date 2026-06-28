import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/breadcrumb";
import { AllergyForm } from "@/components/allergies/allergy-form";
import { getCurrentPatient } from "@/lib/auth";

// Server component. Resolves auth + patient scope, then renders the Add
// Allergy form. No today-default plumbing — First noted is often historical
// and approximate (§4:262), so the native picker starts empty, matching the
// condition form's Diagnosed-on.

export default async function NewAllergyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Breadcrumb patientId={id} trail={[{ label: "allergies", href: "allergies" }, { label: "new" }]} />
      <AllergyForm patientId={patient.patientId} />
    </main>
  );
}
