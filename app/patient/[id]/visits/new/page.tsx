import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/breadcrumb";
import { VisitForm } from "@/components/visits/visit-form";
import { buttonVariants } from "@/components/ui/button";
import { doctorQueries } from "@/db/queries/doctor";
import { getCurrentPatient } from "@/lib/auth";

/*
 * Server component. Resolves auth + patient scope, fetches the doctor options
 * (visits.doctor_id is NOT NULL — the one required entity ref among all the
 * Add/Log forms), then renders the Log Visit form.
 *
 * Zero-doctors guard: a visit can't exist without its doctor, so instead of a
 * form with an unfillable required field, the page routes the user to add the
 * doctor first.
 */

export default async function NewVisitPage({
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
      <Breadcrumb patientId={id} trail={[{ label: "visits", href: "visits" }, { label: "new" }]} />

      {doctors.length === 0 ? (
        <div>
          <h1 className="mb-4 font-heading text-2xl font-semibold leading-tight">
            <span className="border-b-2 border-destructive pb-1">
              Log visit
            </span>
          </h1>
          <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
            <p className="mb-4 text-sm text-muted-foreground">
              A visit needs its doctor on file first. Add the doctor, then log
              the visit.
            </p>
            <Link
              href={`/patient/${id}/doctors/new`}
              className={buttonVariants()}
            >
              + Add doctor
            </Link>
          </div>
        </div>
      ) : (
        <VisitForm
          patientId={patient.patientId}
          doctors={doctors.map((d) => ({
            id: d.id,
            name: d.name,
            specialty: d.specialty,
          }))}
        />
      )}
    </main>
  );
}
