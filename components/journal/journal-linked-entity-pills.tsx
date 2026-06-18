import Link from "next/link";

import type { ResolvedJournalLink } from "@/db/queries/journal";

/*
 * Renders a journal entry's resolved `linked_entities` as `§`-prefixed wiki
 * citation pills (§6.6:1470 / §6.7:1535) — the same convention as chat
 * citations. Periwinkle accent, matching components/citation-pill.tsx.
 *
 * Two modes:
 *  - `interactive` (detail LINKED ENTITIES section) → navigable Links to each
 *    entity's detail page (§6.7's clickable linked context).
 *  - inert (timeline card) → styled spans. The card is itself a whole-card
 *    <Link>, so nested anchors are invalid HTML — the same card-restructure
 *    carryover as the Visit/Report timelines (decisions.md). Tapping the card
 *    opens the entry; per-pill navigation waits for that pass.
 *
 * Empty for every manually-entered entry until the Phase E tagging path writes
 * the refs — parents render nothing when the list is empty.
 */

const PILL_CLASS =
  "inline-flex items-baseline rounded-full bg-accent px-2 py-0.5 font-mono text-[0.7rem] text-accent-foreground ring-1 ring-accent-foreground/15";

interface Props {
  links: ResolvedJournalLink[];
  interactive: boolean;
  className?: string;
}

export function JournalLinkedEntityPills({
  links,
  interactive,
  className,
}: Props) {
  if (links.length === 0) return null;

  return (
    <div className={className ?? "flex flex-wrap gap-1.5"}>
      {links.map((link) =>
        interactive ? (
          <Link
            key={`${link.type}:${link.id}`}
            href={link.href}
            className={`${PILL_CLASS} transition-colors hover:ring-accent-foreground/35`}
          >
            § {link.label}
          </Link>
        ) : (
          <span key={`${link.type}:${link.id}`} className={PILL_CLASS}>
            § {link.label}
          </span>
        ),
      )}
    </div>
  );
}
