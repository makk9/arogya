import { notFound } from "next/navigation";

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
      <nav
        aria-label="breadcrumb"
        className="mb-6 font-mono text-xs text-muted-foreground"
      >
        / patient / {id.slice(0, 8)}… / allergies / new
      </nav>
      <AllergyForm patientId={patient.patientId} />
    </main>
  );
}
