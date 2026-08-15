import { notFound } from "next/navigation";
import { z } from "zod";

import { AskAiButton } from "@/components/ask-ai-button";
import { FamilyHistoryActionsMenu } from "@/components/family-history/family-history-actions-menu";
import { FamilyHistoryCurrentSection } from "@/components/family-history/family-history-current-section";
import { FamilyHistoryDetailHeader } from "@/components/family-history/family-history-detail-header";
import { FamilyHistoryDetailShell } from "@/components/family-history/family-history-detail-shell";
import { FamilyHistoryLinkedContext } from "@/components/family-history/family-history-linked-context";
import { FamilyHistoryNotesSection } from "@/components/family-history/family-history-notes-section";
import { RELATION_LABEL } from "@/components/family-history/family-history-options";
import { conditionQueries } from "@/db/queries/condition";
import { familyHistoryQueries } from "@/db/queries/family-history";
import { getCurrentPatient } from "@/lib/auth";

/*
 * FamilyHistory detail per §6.5 (entity emphasis at 6.5:1404). Two deliberate
 * structural omissions, both spec-locked:
 *  - NO History section — there is no change log (§4:558).
 *  - Linked context only renders when the patient's own conditions match the
 *    family pattern (computed at render time; §6.5:1404 + §6.5:1386).
 */

const entryIdParam = z.string().uuid();

export default async function FamilyHistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>;
}) {
  const { id, entryId: rawEntryId } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  const idCheck = entryIdParam.safeParse(rawEntryId);
  if (!idCheck.success) notFound();
  const entryId = idCheck.data;

  const [entry, conditions] = await Promise.all([
    familyHistoryQueries.getById(patient.patientId, entryId),
    conditionQueries.forPatient(patient.patientId),
  ]);

  if (!entry) notFound();

  // Render-time name match: the patient's own conditions whose names overlap
  // this entry's free-text conditionName (case-insensitive substring, either
  // direction — "Heart attack" matches "Heart Attack (MI)" and vice versa).
  // The shorter side must be ≥3 chars: a 1-2 char name ("A", "BP") as the
  // contained string would match almost everything and render junk links.
  const needle = entry.conditionName.trim().toLowerCase();
  const matches = conditions.filter((c) => {
    const name = c.name.trim().toLowerCase();
    const shorter = Math.min(name.length, needle.length);
    if (shorter < 3) return false;
    return name.includes(needle) || needle.includes(name);
  });

  const notesText = entry.notes?.trim() ?? "";

  const who =
    entry.relationSpecific ?? RELATION_LABEL[entry.relation] ?? entry.relation;
  const displayName = `${who} — ${entry.conditionName}`;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <FamilyHistoryDetailShell entry={entry}>
        <FamilyHistoryDetailHeader
          patientId={patient.patientId}
          entry={entry}
          actionsSlot={
            <FamilyHistoryActionsMenu
              patientId={patient.patientId}
              entryId={entry.id}
              displayName={displayName}
            />
          }
        />

        <FamilyHistoryCurrentSection entry={entry} />

        <FamilyHistoryLinkedContext
          patientId={patient.patientId}
          matches={matches}
        />

        <FamilyHistoryNotesSection notes={notesText} />
      </FamilyHistoryDetailShell>

      <AskAiButton surface={{ key: "family-history-entry", id: entry.id }} />
    </main>
  );
}
