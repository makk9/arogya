import Link from "next/link";

import { JournalLinkedEntityPills } from "@/components/journal/journal-linked-entity-pills";
import type { ResolvedJournalLink } from "@/db/queries/journal";
import type { JournalEntry } from "@/db/schema";

/*
 * Journal timeline card per design.md §6.6:1470 — date column left
 * (`APR / 12 / Sun`), dotted vertical separator, content right: optional title
 * (entries can be title-less), a 3–4 line content preview (hard-truncated with
 * `…`, §6.6:1488 — no inline expand), and the linked-entity `§` pills at the
 * bottom. Whole card navigates to the entry detail.
 *
 * No most-recent tint (§6.6:1443/1475 — skipped for Journal; the user knows what
 * they just wrote). Linked pills render inert here (the card is a whole-card
 * anchor — see JournalLinkedEntityPills) and are empty until Phase E tagging.
 */

interface JournalTimelineCardProps {
  patientId: string;
  entry: JournalEntry;
  links: ResolvedJournalLink[];
}

const WEEKDAY_FMT = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short" });

function dateParts(isoDate: string): {
  month: string;
  day: string;
  weekday: string;
} {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return {
    month: MONTH_FMT.format(date).toUpperCase(),
    day: String(d),
    weekday: WEEKDAY_FMT.format(date),
  };
}

export function JournalTimelineCard({
  patientId,
  entry,
  links,
}: JournalTimelineCardProps) {
  const { month, day, weekday } = dateParts(entry.entryDate);
  const title = entry.title?.trim();

  return (
    <Link
      href={`/patient/${patientId}/journal/${entry.id}`}
      className="flex gap-4 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-foreground/30 hover:bg-muted/40"
    >
      <div className="flex w-10 shrink-0 flex-col items-center pt-0.5 text-center">
        <span className="font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">
          {month}
        </span>
        <span className="font-heading text-lg font-semibold leading-tight">
          {day}
        </span>
        <span className="font-mono text-[0.65rem] text-muted-foreground">
          {weekday}
        </span>
      </div>

      <div
        aria-hidden
        className="w-0 self-stretch border-l border-dotted border-border"
      />

      <div className="min-w-0 flex-1">
        {title ? (
          <p className="truncate text-sm font-medium">{title}</p>
        ) : null}
        <p
          className={`whitespace-pre-line text-xs leading-relaxed text-muted-foreground ${
            title ? "mt-1" : ""
          } line-clamp-4`}
        >
          {entry.content}
        </p>
        <JournalLinkedEntityPills
          links={links}
          interactive={false}
          className="mt-2 flex flex-wrap gap-1.5"
        />
      </div>
    </Link>
  );
}
