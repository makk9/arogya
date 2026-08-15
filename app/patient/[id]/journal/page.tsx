import Link from "next/link";
import { notFound } from "next/navigation";

import { AskAiButton } from "@/components/ask-ai-button";
import { Breadcrumb } from "@/components/breadcrumb";
import { JournalEmptyState } from "@/components/journal/journal-empty-state";
import { JournalTimelineCard } from "@/components/journal/journal-timeline-card";
import { TimelineShowEarlier } from "@/components/visits/timeline-show-earlier";
import { buttonVariants } from "@/components/ui/button";
import {
  journalQueries,
  type ResolvedJournalLink,
} from "@/db/queries/journal";
import type { JournalEntry } from "@/db/schema";
import { getCurrentPatient } from "@/lib/auth";
import { formatRelativeDate } from "@/lib/datetime";

/*
 * Journal timeline per the §6.6 event-timeline template — the user's own
 * free-form dated notes. Month-grouped, reverse chronological, date-anchored
 * cards. No filter pill (§6.6:1451) and no most-recent tint (§6.6:1443 — skipped
 * for Journal). Subtitle voice: "written by you" (§6.6:1471).
 */

const VISIBLE_TARGET = 10;

interface MonthSection {
  key: string; // YYYY-MM
  label: string; // APRIL 2026
  entries: JournalEntry[];
}

const MONTH_LABEL_FMT = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

function monthSections(entries: JournalEntry[]): MonthSection[] {
  const sections: MonthSection[] = [];
  for (const e of entries) {
    const key = e.entryDate.slice(0, 7);
    let section = sections[sections.length - 1];
    if (!section || section.key !== key) {
      const [y, m] = key.split("-").map(Number);
      section = {
        key,
        label: MONTH_LABEL_FMT.format(new Date(y, m - 1, 1)).toUpperCase(),
        entries: [],
      };
      sections.push(section);
    }
    section.entries.push(e);
  }
  return sections;
}

export default async function JournalTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  const entries = await journalQueries.forPatient(patient.patientId);

  // Resolve each entry's linked-entity refs to navigable pills. Empty (and
  // instant) for manual entries; batched per type once Phase E tagging lands.
  const linksByEntry = new Map<string, ResolvedJournalLink[]>();
  await Promise.all(
    entries.map(async (e) => {
      linksByEntry.set(
        e.id,
        await journalQueries.resolveLinkedEntities(
          patient.patientId,
          e.linkedEntities,
        ),
      );
    }),
  );

  const totalCount = entries.length;
  const mostRecent = entries[0];

  const subtitleParts: string[] = ["written by you"];
  if (mostRecent) {
    subtitleParts.push(`most recent ${formatRelativeDate(mostRecent.entryDate)}`);
  }

  const sections = monthSections(entries);
  const visibleSections: MonthSection[] = [];
  const earlierSections: MonthSection[] = [];
  let visibleCount = 0;
  for (const section of sections) {
    if (visibleCount < VISIBLE_TARGET) {
      visibleSections.push(section);
      visibleCount += section.entries.length;
    } else {
      earlierSections.push(section);
    }
  }
  const earlierCount = earlierSections.reduce((n, s) => n + s.entries.length, 0);

  function renderSection(section: MonthSection) {
    return (
      <section key={section.key}>
        <h2 className="font-mono text-[0.7rem] uppercase tracking-wide text-muted-foreground">
          {section.label} · {section.entries.length}{" "}
          {section.entries.length === 1 ? "entry" : "entries"}
        </h2>
        <div className="mt-3 flex flex-col gap-2">
          {section.entries.map((e) => (
            <JournalTimelineCard
              key={e.id}
              patientId={patient.patientId}
              entry={e}
              links={linksByEntry.get(e.id) ?? []}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Breadcrumb patientId={id} trail={[{ label: "journal" }]} />

      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold leading-tight">
          <span className="border-b-2 border-destructive pb-1">Journal</span>
          {totalCount > 0 ? (
            <span className="ml-2 text-muted-foreground">· {totalCount}</span>
          ) : null}
        </h1>
        <Link href={`/patient/${id}/journal/new`} className={buttonVariants()}>
          + New entry
        </Link>
      </div>

      {totalCount > 0 ? (
        <p className="mb-6 text-sm text-muted-foreground">
          {subtitleParts.join(" · ")}
        </p>
      ) : (
        <div className="mb-6" />
      )}

      {totalCount === 0 ? (
        <JournalEmptyState patientId={patient.patientId} />
      ) : (
        <div className="flex flex-col gap-6">
          {visibleSections.map(renderSection)}
          {earlierSections.length > 0 ? (
            <TimelineShowEarlier hiddenCount={earlierCount} noun="entries">
              <div className="flex flex-col gap-6">
                {earlierSections.map(renderSection)}
              </div>
            </TimelineShowEarlier>
          ) : null}
        </div>
      )}

      <AskAiButton surface={{ key: "journal-list" }} />
    </main>
  );
}
