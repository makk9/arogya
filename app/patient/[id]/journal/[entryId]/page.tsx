import { notFound } from "next/navigation";
import { z } from "zod";

import { AskAiButton } from "@/components/ask-ai-button";
import { JournalActionsMenu } from "@/components/journal/journal-actions-menu";
import { JournalBodySection } from "@/components/journal/journal-body-section";
import { JournalDetailHeader } from "@/components/journal/journal-detail-header";
import { JournalDetailShell } from "@/components/journal/journal-detail-shell";
import { JournalLinkedContextSection } from "@/components/journal/journal-linked-context-section";
import { journalQueries } from "@/db/queries/journal";
import { getCurrentPatient } from "@/lib/auth";
import { journalDisplayTitle } from "@/lib/journal";

/*
 * Journal detail per the §6.7 event-detail template — the leanest of the five.
 * Section order: body (ENTRY) → Linked context. NO Outcomes (§6.7:1525 — Journal
 * produces none) and NO Notes (§6.7:1527 — the body IS the note). Linked context
 * carries the resolved linked-entity pills + same-month sibling entries.
 */

const entryIdParam = z.string().uuid();

export default async function JournalDetailPage({
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

  const entry = await journalQueries.getById(patient.patientId, entryId);
  if (!entry) notFound();

  const [links, siblings] = await Promise.all([
    journalQueries.resolveLinkedEntities(patient.patientId, entry.linkedEntities),
    journalQueries.siblingsThisMonth(patient.patientId, entry),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <JournalDetailShell entry={entry}>
        <JournalDetailHeader
          patientId={patient.patientId}
          entry={entry}
          actionsSlot={
            <JournalActionsMenu
              patientId={patient.patientId}
              entryId={entry.id}
              entryLabel={journalDisplayTitle(entry)}
            />
          }
        />

        <div className="mt-6">
          <JournalBodySection entry={entry} />
        </div>

        <JournalLinkedContextSection
          patientId={patient.patientId}
          links={links}
          siblings={siblings}
        />
      </JournalDetailShell>

      <AskAiButton surface={{ key: "journal-entry", id: entry.id }} />
    </main>
  );
}
