import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/breadcrumb";
import { ReportForm } from "@/components/reports/report-form";
import { doctorQueries } from "@/db/queries/doctor";
import { visitQueries } from "@/db/queries/visit";
import { getCurrentPatient } from "@/lib/auth";
import { formatAbsoluteDate } from "@/lib/datetime";
import { displayDoctorName } from "@/lib/doctor-display";

/*
 * Server component. Resolves auth + patient scope, fetches the doctor + visit
 * options (both optional linked refs on a report), then renders the Log Report
 * form. No zero-doctors guard — unlike a Visit, a Report doesn't require a
 * doctor (linked_doctor_id is nullable, §4:491).
 */

export default async function NewReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  const [doctors, visits] = await Promise.all([
    doctorQueries.forPatient(patient.patientId),
    visitQueries.forPatient(patient.patientId),
  ]);

  const doctorMap = new Map(doctors.map((d) => [d.id, d]));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Breadcrumb patientId={id} trail={[{ label: "reports", href: "reports" }, { label: "new" }]} />

      <ReportForm
        patientId={patient.patientId}
        doctors={doctors.map((d) => ({
          id: d.id,
          label: `${displayDoctorName(d.name)} · ${d.specialty}`,
        }))}
        visits={visits.map((v) => {
          const d = doctorMap.get(v.doctorId);
          const who = d ? displayDoctorName(d.name) : "Visit";
          return {
            id: v.id,
            label: `${who} · ${formatAbsoluteDate(v.visitDate)}`,
          };
        })}
      />
    </main>
  );
}
