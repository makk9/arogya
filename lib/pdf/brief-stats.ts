import { tokenizeCitations } from "@/lib/citations/parse";
import { formatAbsoluteDate } from "@/lib/datetime";

import type { BriefPdfStats } from "./brief-document";

/**
 * Footer stats for the brief PDF (design.md 5.7: "Generated from [N] data
 * points across [date range]").
 *
 * N = distinct vault citations in the brief text — the same evidence set the
 * user reviewed as inline pills in chat before exporting (decisions.md
 * 2026-08-15). The date range spans the ISO dates event-entity slugs embed
 * (`visit:2026-05-08`, `vital:blood_pressure:2026-07-22`,
 * `lab-result:<marker>:<date>`, …); state entities (med, condition, allergy,
 * doctor) count toward N but carry no date in their slug, so they don't move
 * the range. Uses the shared tokenizer — compound slugs parse whole since the
 * 2026-08-15 fix, so distinct same-type readings stay distinct.
 */

const ISO_DATE_RE = /\d{4}-\d{2}-\d{2}/g;

export function briefStatsFromText(raw: string): BriefPdfStats {
  const cited = new Set<string>();
  const dates: string[] = [];

  for (const seg of tokenizeCitations(raw)) {
    if (seg.kind !== "vault") continue;
    cited.add(`${seg.entityType}:${seg.slug ?? ""}`);
    for (const iso of (seg.slug ?? "").matchAll(ISO_DATE_RE)) {
      // Guard against date-shaped garbage in a slug (e.g. "0000-99-99").
      const [y, m, d] = iso[0].split("-").map(Number);
      const parsed = new Date(y, m - 1, d);
      if (parsed.getMonth() === m - 1 && parsed.getDate() === d) {
        dates.push(iso[0]);
      }
    }
  }

  let rangeLabel: string | null = null;
  if (dates.length > 0) {
    dates.sort();
    const min = dates[0];
    const max = dates[dates.length - 1];
    rangeLabel =
      min === max
        ? formatAbsoluteDate(min)
        : `${formatAbsoluteDate(min)} – ${formatAbsoluteDate(max)}`;
  }

  return { dataPoints: cited.size, rangeLabel };
}
