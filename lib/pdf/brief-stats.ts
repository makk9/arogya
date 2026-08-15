import { formatAbsoluteDate } from "@/lib/datetime";

import type { BriefPdfStats } from "./brief-document";

/**
 * Footer stats for the brief PDF (design.md 5.7: "Generated from [N] data
 * points across [date range]").
 *
 * N = distinct vault citations in the brief text — the same evidence set the
 * user reviewed as inline pills in chat before exporting (decisions.md
 * 2026-08-15). The date range spans the ISO dates embedded in event-entity
 * slugs (visit/lab/vital/journal/symptom-episode/report cite as
 * `type:...:YYYY-MM-DD`); state entities (med, condition, allergy, doctor)
 * count toward N but carry no date in their slug, so they don't move the range.
 *
 * This scans the raw text directly rather than reusing `tokenizeCitations`,
 * whose slug charset stops at the first extra colon group and would both
 * collapse distinct same-type readings (two BP readings → one key) and lose
 * the embedded dates.
 */

// Full vault-citation form including every colon group the serializers emit.
// `_` joins tail words too — vital slugs embed snake_case reading types
// (`vital:blood_pressure:2026-04-01`); without it, distinct readings collapse
// to one key and their dates are lost.
const VAULT_CITATION_RE = /§\s*([a-z][a-z0-9-]*)((?:[:_]\s*[a-z0-9/-]+)*)/g;
const ISO_DATE_RE = /\d{4}-\d{2}-\d{2}/g;

export function briefStatsFromText(raw: string): BriefPdfStats {
  const cited = new Set<string>();
  const dates: string[] = [];

  for (const match of raw.matchAll(VAULT_CITATION_RE)) {
    const [, entityType, tail] = match;
    cited.add(`${entityType}${tail.replace(/\s/g, "")}`);
    for (const iso of tail.matchAll(ISO_DATE_RE)) {
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
