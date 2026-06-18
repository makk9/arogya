import Link from "next/link";

import { JournalLinkedEntityPills } from "@/components/journal/journal-linked-entity-pills";
import type { ResolvedJournalLink } from "@/db/queries/journal";
import type { JournalEntry } from "@/db/schema";
import { formatRelativeDate } from "@/lib/datetime";
import { journalReferenceLabel } from "@/lib/journal";

/*
 * The §6.7:1535 Linked context for a JournalEntry — two sub-sections:
 *  - LINKED ENTITIES · N — the entities the user tagged at write-time
 *    (resolved `linked_entities`), as navigable `§` pills. Empty until Phase E.
 *  - OTHER JOURNAL ENTRIES FROM THIS MONTH · N — sibling entries sharing the
 *    month, with relative-date subtitles and `(untitled)`/first-line labels.
 *
 * Each sub-section omits when empty; the whole section omits when both are.
 * There is NO Outcomes and NO Notes section for Journal (§6.7:1525/1527).
 */

interface Props {
  patientId: string;
  links: ResolvedJournalLink[];
  siblings: JournalEntry[];
}

export function JournalLinkedContextSection({
  patientId,
  links,
  siblings,
}: Props) {
  if (links.length === 0 && siblings.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Linked context
      </h2>

      {links.length > 0 ? (
        <div className="mb-5">
          <p className="mb-2 text-xs text-muted-foreground">
            Linked entities · {links.length}
          </p>
          <JournalLinkedEntityPills links={links} interactive />
        </div>
      ) : null}

      {siblings.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">
            Other journal entries from this month · {siblings.length}
          </p>
          {siblings.map((s) => (
            <Link
              key={s.id}
              href={`/patient/${patientId}/journal/${s.id}`}
              className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm transition-colors hover:border-foreground/30 hover:bg-muted/40"
            >
              <span className="font-medium">{journalReferenceLabel(s)}</span>
              <span className="text-muted-foreground">
                {" "}
                · {formatRelativeDate(s.entryDate)}
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
