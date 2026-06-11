import { notFound } from "next/navigation";

import { ConditionForm } from "@/components/conditions/condition-form";
import { getCurrentPatient } from "@/lib/auth";

// Server component. Resolves auth + patient scope, then renders the Add
// Condition form. There's no today-default
// plumbing — the condition form's Diagnosed-on field has no today-default
// (diagnoses are often historical or unknown; see design.md 6.12).

export default async function NewConditionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {/*
        Breadcrumb shape per design.md 6.12:1833 (`/ patient / [id] / conditions / new`).
        Patient ID truncated to first 8 chars + ellipsis — matches the medication
        new-page; becomes a friendly slug once Phase 6.10 (patient profile) ships.
      */}
      <nav
        aria-label="breadcrumb"
        className="mb-6 font-mono text-xs text-muted-foreground"
      >
        / patient / {id.slice(0, 8)}… / conditions / new
      </nav>
      <ConditionForm patientId={patient.patientId} />
    </main>
  );
}
