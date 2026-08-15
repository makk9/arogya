import { notFound } from "next/navigation";

import { AskAiButton } from "@/components/ask-ai-button";
import { LifestyleChangeEntry } from "@/components/lifestyle/lifestyle-change-entry";
import { LifestyleCurrentSection } from "@/components/lifestyle/lifestyle-current-section";
import { LifestyleDetailHeader } from "@/components/lifestyle/lifestyle-detail-header";
import { LifestyleDetailShell } from "@/components/lifestyle/lifestyle-detail-shell";
import { LifestyleHistorySection } from "@/components/lifestyle/lifestyle-history-section";
import { LifestyleNotesSection } from "@/components/lifestyle/lifestyle-notes-section";
import {
  lifestyleChangeQueries,
  lifestyleQueries,
} from "@/db/queries/lifestyle";
import { getCurrentPatient } from "@/lib/auth";

/*
 * Lifestyle profile per §6.5's LifestyleProfile variation (6.5:1403): a
 * singleton detail surface — no list page, no /new route (no §6.12 Add form;
 * the profile is onboarding-populated in Phase E and inline-populated until
 * then), reached from the patient profile's "Lifestyle profile · last updated
 * [date]" link (§6.10:1686).
 *
 * Two spec-locked omissions: Linked context is omitted ENTIRELY (§6.5:1423),
 * and there's no `…` actions menu (no status transitions, no delete story for
 * a singleton). The page renders fine with no profile row — every section
 * handles null, and the first write creates the row.
 */

const RECENT_LIMIT = 5;

export default async function LifestylePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  const [profileRow, changes] = await Promise.all([
    lifestyleQueries.getForPatient(patient.patientId),
    lifestyleChangeQueries.forPatient(patient.patientId),
  ]);
  const profile = profileRow ?? null;

  // Pre-render entry arrays server-side; the History island just toggles
  // visibility. Collapse only when total > RECENT_LIMIT.
  const totalCount = changes.length;
  const recentEntries = changes
    .slice(0, RECENT_LIMIT)
    .map((c) => <LifestyleChangeEntry key={c.id} change={c} />);
  const olderEntries =
    totalCount > RECENT_LIMIT
      ? changes
          .slice(RECENT_LIMIT)
          .map((c) => <LifestyleChangeEntry key={c.id} change={c} />)
      : null;

  const notesText = profile?.notes?.trim() ?? "";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <LifestyleDetailShell profile={profile}>
        <LifestyleDetailHeader
          patientId={patient.patientId}
          updatedAt={profile?.updatedAt ?? null}
        />

        <div className="mt-6">
          <LifestyleCurrentSection profile={profile} />
        </div>

        <LifestyleHistorySection
          totalCount={totalCount}
          recentEntries={recentEntries}
          olderEntries={olderEntries}
        />

        <LifestyleNotesSection notes={notesText} />
      </LifestyleDetailShell>

      <AskAiButton surface={{ key: "lifestyle" }} />
    </main>
  );
}
