import { notFound } from "next/navigation";

import { LabReportForm } from "@/components/labs/lab-report-form";
import { doctorQueries } from "@/db/queries/doctor";
import { getCurrentPatient } from "@/lib/auth";

/*
 * Server component for `Log lab report`. Resolves auth + patient scope, fetches
 * the doctor options for the optional ordering-doctor select, then renders the
 * form. Unlike the Visit form there is no zero-doctors guard — orderedBy is
 * optional (a patient may have ordered the panel themselves).
 */

export default async function NewLabReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  const doctors = await doctorQueries.forPatient(patient.patientId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <nav
        aria-label="breadcrumb"
        className="mb-6 font-mono text-xs text-muted-foreground"
      >
        / patient / {id.slice(0, 8)}… / labs / new
      </nav>

      <LabReportForm
        patientId={patient.patientId}
        doctors={doctors.map((d) => ({
          id: d.id,
          name: d.name,
          specialty: d.specialty,
        }))}
      />
    </main>
  );
}
