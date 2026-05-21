import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { medicationQueries } from "@/db/queries/medication";
import { getCurrentPatient } from "@/lib/auth";

/*
 * Interim minimal list page — Phase C item 2 ships this as a thin landing
 * surface so the form's Save / Cancel flows have somewhere to navigate. The
 * full design.md 6.4 state-list template (section-grouped cards by status,
 * filter pills, floating Ask AI button, empty-state illustration) lands in
 * Phase C item 3 — at which point this file is the seed to expand, not
 * delete.
 */

export default async function MedicationsListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  const medications = await medicationQueries.forPatient(patient.patientId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {/*
        Breadcrumb shape per design.md 6.12:1833. Patient ID truncated to first 8 chars
        — see new/page.tsx for the rationale; behavior is identical here.
      */}
      <nav
        aria-label="breadcrumb"
        className="mb-6 font-mono text-xs text-muted-foreground"
      >
        / patient / {id.slice(0, 8)}… / medications
      </nav>

      <div className="mb-8 flex items-start justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold leading-tight">
          <span className="border-b-2 border-destructive pb-1">Medications</span>
        </h1>
        <Link
          href={`/patient/${id}/medications/new`}
          className={buttonVariants()}
        >
          + Add medication
        </Link>
      </div>

      {medications.length === 0 ? (
        <p className="text-sm text-muted-foreground">No medications yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {medications.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{m.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {m.currentDose} · {m.currentFrequency}
                </div>
              </div>
              <span
                className="font-mono text-[0.7rem] uppercase tracking-wide text-muted-foreground"
                aria-label={`status ${m.status}`}
              >
                {m.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
