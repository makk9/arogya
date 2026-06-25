import Link from "next/link";

import { InsightLinkedPills } from "@/components/insights/insight-linked-pills";
import { CATEGORY_LABEL, SEVERITY_DOT } from "@/components/insights/insight-options";
import type { ResolvedEntityLink } from "@/db/queries/entity-links";
import type { Insight } from "@/db/schema";
import { tokenizeCitations } from "@/lib/citations/parse";
import { formatRelative } from "@/lib/datetime";

/*
 * Insight feed card per §6.8:1579. Layout:
 *   [severity dot]  Title
 *                   2-line body preview …
 *                   [category pill] · [relative date] · [§ linked pills]
 *
 * Severity dot sits at the far-left edge (§6.8:1581) — filled only for urgent /
 * attention; lower severities reserve the column width but show nothing, so all
 * cards align. Whole card navigates to the detail page (§6.8:1567). Pills here
 * are inert (the card is the anchor). All color via semantic tokens.
 */

interface Props {
  patientId: string;
  insight: Insight;
  links: ResolvedEntityLink[];
}

// Body preview: drop citation tokens (their slugs read as noise in plain text)
// and strip markdown emphasis/heading marks, then collapse whitespace. The card
// shows prose; the live pills live on the detail body.
function previewText(body: string): string {
  const plain = tokenizeCitations(body)
    .filter((seg) => seg.kind === "text")
    .map((seg) => seg.text)
    .join("")
    .replace(/[*#_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain;
}

export function InsightCard({ patientId, insight, links }: Props) {
  const dot = SEVERITY_DOT[insight.severity];
  const categoryLabel = CATEGORY_LABEL[insight.category] ?? insight.category;

  return (
    <Link
      href={`/patient/${patientId}/insights/${insight.id}`}
      className="flex gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-foreground/30 hover:bg-muted/40"
    >
      <div className="flex w-2 shrink-0 justify-center pt-1.5">
        {dot ? (
          <span
            aria-label={`${dot.label} severity`}
            className={`h-2 w-2 rounded-full ${dot.tokenClass}`}
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{insight.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
          {previewText(insight.body)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1.5 text-[0.7rem] text-muted-foreground">
          <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5">
            {categoryLabel}
          </span>
          <span aria-hidden>·</span>
          <span>{formatRelative(insight.generatedAt)}</span>
          {links.length > 0 ? <span aria-hidden>·</span> : null}
          <InsightLinkedPills links={links} interactive={false} className="flex flex-wrap gap-1.5" />
        </div>
      </div>
    </Link>
  );
}
