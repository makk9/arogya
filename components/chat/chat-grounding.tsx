"use client";

/**
 * MessageGrounding — the per-message "grounded in →" footer (design.md
 * 6.2:1207): every entity a single reply cited, as a scannable strip. Reuses
 * the same CitationPill the message body renders, so a chip is the identical
 * interactive pill (vault → popover preview + View full →; external → inert).
 * Grounding is derived from message text at render, never stored.
 *
 * (The conversation-level header strip from 6.2:1192 was dropped 2026-06-29 —
 * it duplicated this footer and ate header width. See decisions.md.)
 */

import { CitationPill } from "@/components/citation-pill";
import type { Grounding, GroundingRef } from "@/lib/citations/grounding";

function GroundingChip({ item }: { item: GroundingRef }) {
  if (item.kind === "external") {
    return (
      <CitationPill variant="external" sourceName={item.sourceName ?? ""}>
        {item.label}
      </CitationPill>
    );
  }
  // Empty slug → CitationPill renders an inert span (a type-only reference with
  // no specific entity to open), which is the right behavior here.
  return (
    <CitationPill
      variant="vault"
      entityType={item.entityType ?? ""}
      slug={item.slug ?? ""}
    >
      {item.label}
    </CitationPill>
  );
}

export function MessageGrounding({ grounding }: { grounding: Grounding }) {
  const refs = [...grounding.vault, ...grounding.external];
  if (refs.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span aria-hidden>grounded in →</span>
      <span className="flex flex-wrap items-center gap-1">
        {refs.map((item) => (
          <GroundingChip key={item.key} item={item} />
        ))}
      </span>
    </div>
  );
}
