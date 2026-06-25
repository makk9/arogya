import Link from "next/link";

import type { ResolvedEntityLink } from "@/db/queries/entity-links";

/*
 * Renders an insight's resolved `linked_entities` as `§`-prefixed wiki citation
 * pills (§6.8:1584 card bottom row / §6.9:1628 Linked context). Same periwinkle
 * accent as components/citation-pill.tsx and the journal pills.
 *
 * Two modes:
 *  - `interactive` (detail Linked-context) → navigable Links.
 *  - inert (feed card) → styled spans, because the card is itself a whole-card
 *    <Link> and nested anchors are invalid HTML (same carryover as the journal
 *    / visit / report timelines).
 */

const PILL_CLASS =
  "inline-flex items-baseline rounded-full bg-accent px-2 py-0.5 font-mono text-[0.7rem] text-accent-foreground ring-1 ring-accent-foreground/15";

interface Props {
  links: ResolvedEntityLink[];
  interactive: boolean;
  className?: string;
}

export function InsightLinkedPills({ links, interactive, className }: Props) {
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
