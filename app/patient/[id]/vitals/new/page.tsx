import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/breadcrumb";
import { VitalForm } from "@/components/vitals/vital-form";
import { getCurrentPatient } from "@/lib/auth";

/*
 * Server component for `Log reading`. Reached from the vitals history page's
 * "+ Log reading" (and by URL / the symptom flow); saving returns there.
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
      <Breadcrumb patientId={id} trail={[{ label: "vitals", href: "vitals" }, { label: "new" }]} />

      <VitalForm patientId={patient.patientId} />
    </main>
  );
}
