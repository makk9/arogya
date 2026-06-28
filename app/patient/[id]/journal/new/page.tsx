import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/breadcrumb";
import { JournalForm } from "@/components/journal/journal-form";
import { getCurrentPatient } from "@/lib/auth";

/*
 * Server component. Resolves auth + patient scope, then renders the New Entry
 * form. No setup data to fetch — a journal entry references no other entity at
 * direct entry (linked entities are AI-tagged in Phase E).
 */
export default async function NewJournalEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Breadcrumb patientId={id} trail={[{ label: "journal", href: "journal" }, { label: "new" }]} />

      <JournalForm patientId={patient.patientId} />
    </main>
  );
}
