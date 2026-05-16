/**
 * Visual citation pill. Two variants — vault (`§ entity-type:slug`) and external
 * (`↗ source-name`) — distinguishable per design.md 6.2:1204-1205.
 *
 * Phase B scope: inert (no popover, no onClick). Vault pills carry data-* attrs
 * so the Phase C item 7 popover wrapper can read entity-type + slug without
 * re-parsing. Rendered as <span> (not <button>) to avoid implying interactivity
 * before the Phase C wiring lands.
 *
 * Color palette: `stone-100` and `stone-200` are intentionally restrained
 * placeholders — two near-identical neutral grays that keep vault and external
 * pills visually distinguishable without claiming the brand. Both are
 * placeholders only. Phase C item 7 picks real colors from the 7.2:2139
 * earth-tone family (sage / seafoam / dusty clay / aged linen / soft
 * eucalyptus / muted terracotta) once the palette is locked. Do not extend
 * either color elsewhere in the UI before the palette decision.
 */

import type { ReactNode } from "react";

interface VaultPillProps {
  variant: "vault";
  entityType: string;
  slug: string;
  children: ReactNode;
}

interface ExternalPillProps {
  variant: "external";
  sourceName: string;
  children: ReactNode;
}

export type CitationPillProps = VaultPillProps | ExternalPillProps;

export function CitationPill(props: CitationPillProps): ReactNode {
  if (props.variant === "vault") {
    return (
      <span
        data-citation-type="vault"
        data-entity-type={props.entityType}
        data-slug={props.slug}
        className="inline-flex items-baseline rounded-full bg-stone-100 px-2 py-0.5 font-mono text-[0.85em] text-stone-700 ring-1 ring-stone-200"
      >
        {props.children}
      </span>
    );
  }
  return (
    <span
      data-citation-type="external"
      data-source-name={props.sourceName}
      className="inline-flex items-baseline rounded-full bg-stone-200 px-2 py-0.5 font-mono text-[0.85em] text-stone-800 ring-1 ring-stone-300"
    >
      {props.children}
    </span>
  );
}
