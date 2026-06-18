import { notFound } from "next/navigation";

import { SymptomForm } from "@/components/symptoms/symptom-form";
import { READING_TYPE_LABEL, formatVitalValue } from "@/components/vitals/vital-options";
import { symptomTypeQueries } from "@/db/queries/symptom";
import { vitalQueries } from "@/db/queries/vital";
import { getCurrentPatient } from "@/lib/auth";
import { formatAbsoluteDate } from "@/lib/datetime";

/*
 * Server component for `Log symptom`. Loads existing symptom types (for the
 * autocomplete) and recent readings (for the optional linked-vital select),
 * then renders the form. A new type is created inline via the episode POST when
 * the user picks "+ Create new", so no zero-types guard is needed (unlike the
 * Log-visit zero-doctors guard).
 *
 * `?type=<id>` (from a SymptomType page's "+ Log episode") locks the form's
 * Symptom field to that type — the user is logging an episode FOR that symptom,
 * so the chooser is removed. An unrecognised/out-of-scope id is ignored (the
 * form falls back to the normal open chooser).
 */
export default async function NewSymptomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  const [types, vitals] = await Promise.all([
    symptomTypeQueries.forPatient(patient.patientId),
    vitalQueries.forPatient(patient.patientId),
  ]);

  const sp = await searchParams;
  const rawType = Array.isArray(sp.type) ? sp.type[0] : sp.type;
  const lockedTypeRow = rawType
    ? types.find((t) => t.id === rawType)
    : undefined;
  const lockedType = lockedTypeRow
    ? { id: lockedTypeRow.id, name: lockedTypeRow.name }
    : undefined;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <nav
        aria-label="breadcrumb"
        className="mb-6 font-mono text-xs text-muted-foreground"
      >
        / patient / {id.slice(0, 8)}… / symptoms / new
      </nav>

      <SymptomForm
        patientId={patient.patientId}
        types={types.map((t) => ({ id: t.id, name: t.name }))}
        lockedType={lockedType}
        vitals={vitals.map((v) => ({
          id: v.id,
          label: `${READING_TYPE_LABEL[v.readingType] ?? v.readingType} ${formatVitalValue(v)} · ${formatAbsoluteDate(v.recordedAt)}`,
        }))}
      />
    </main>
  );
}
