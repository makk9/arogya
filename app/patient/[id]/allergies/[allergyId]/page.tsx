import { notFound } from "next/navigation";
import { z } from "zod";

import { AskAiButton } from "@/components/ask-ai-button";
import { AllergyActionsMenu } from "@/components/allergies/allergy-actions-menu";
import { AllergyChangeEntry } from "@/components/allergies/allergy-change-entry";
import { AllergyCurrentSection } from "@/components/allergies/allergy-current-section";
import { AllergyDetailHeader } from "@/components/allergies/allergy-detail-header";
import { AllergyDetailShell } from "@/components/allergies/allergy-detail-shell";
import { AllergyHistorySection } from "@/components/allergies/allergy-history-section";
import { AllergyNotesSection } from "@/components/allergies/allergy-notes-section";
import { allergyChangeQueries, allergyQueries } from "@/db/queries/allergy";
import { doctorQueries } from "@/db/queries/doctor";
import { getCurrentPatient } from "@/lib/auth";
import { allergySurfaceContext } from "@/lib/chat/surface-context";

/*
 * Allergy detail per §6.5 (entity emphasis at 6.5:1402). One deliberate
 * omission: NO Linked context section. The spec's "medications flagged for
 * interaction" has no stored representation — §4:270 keeps cross-reactions as
 * AI reasoning-time work, so there is nothing to query until the insight
 * generator lands (Phase E). Rendering an empty section would signal "we
 * forgot to populate this" (§6.5:1386's omission rationale).
 */

const allergyIdParam = z.string().uuid();
const RECENT_LIMIT = 5;

export default async function AllergyDetailPage({
  params,
}: {
  params: Promise<{ id: string; allergyId: string }>;
}) {
  const { id, allergyId: rawAllergyId } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  const idCheck = allergyIdParam.safeParse(rawAllergyId);
  if (!idCheck.success) notFound();
  const allergyId = idCheck.data;

  const [allergy, changes, doctors] = await Promise.all([
    allergyQueries.getById(patient.patientId, allergyId),
    allergyChangeQueries.forAllergy(patient.patientId, allergyId),
    doctorQueries.forPatient(patient.patientId),
  ]);

  if (!allergy) notFound();

  const confirmedByDoctor = allergy.confirmedBy
    ? doctors.find((d) => d.id === allergy.confirmedBy)
    : undefined;

  // Pre-render entry arrays server-side; the History island just toggles
  // visibility. Collapse only when total > RECENT_LIMIT.
  const totalCount = changes.length;
  const recentEntries = changes
    .slice(0, RECENT_LIMIT)
    .map((c) => <AllergyChangeEntry key={c.id} change={c} />);
  const olderEntries =
    totalCount > RECENT_LIMIT
      ? changes
          .slice(RECENT_LIMIT)
          .map((c) => <AllergyChangeEntry key={c.id} change={c} />)
      : null;

  const notesText = allergy.notes?.trim() ?? "";

  const doctorOptions = doctors.map((d) => ({
    id: d.id,
    name: d.name,
    specialty: d.specialty,
  }));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <AllergyDetailShell allergy={allergy}>
        <AllergyDetailHeader
          patientId={patient.patientId}
          allergy={allergy}
          actionsSlot={
            <AllergyActionsMenu
              patientId={patient.patientId}
              allergyId={allergy.id}
              substance={allergy.substance}
            />
          }
        />

        <AllergyCurrentSection
          patientId={patient.patientId}
          allergy={allergy}
          confirmedByDoctor={confirmedByDoctor}
          doctorOptions={doctorOptions}
        />

        <AllergyHistorySection
          totalCount={totalCount}
          recentEntries={recentEntries}
          olderEntries={olderEntries}
        />

        <AllergyNotesSection notes={notesText} />
      </AllergyDetailShell>

      <AskAiButton surfaceContext={allergySurfaceContext(allergy)} />
    </main>
  );
}
