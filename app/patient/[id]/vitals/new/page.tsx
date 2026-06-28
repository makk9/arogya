import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/breadcrumb";
import { VitalForm } from "@/components/vitals/vital-form";
import { getCurrentPatient } from "@/lib/auth";

/*
 * Server component for `Log reading`. Vitals are a create-only surface in v1 —
 * no list/timeline/detail page (§6.6's event rail doesn't include vitals; they
 * surface as `●` pills on symptom episodes). This page is reachable by URL and
 * from the symptom flow; the dashboard/rail quick-action wiring lands in Phase E.
 */
export default async function NewVitalReadingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Breadcrumb patientId={id} trail={[{ label: "vitals" }, { label: "new" }]} />

      <VitalForm patientId={patient.patientId} />
    </main>
  );
}
