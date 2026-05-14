import type { Insight } from "@/db/schema";

import {
  citationFor,
  compareById,
  formatISODate,
  type SlugIndex,
} from "./format";

export type InsightSerializationMode = "deduplication-only" | "full";

const DEDUP_FRAMING = `These insights have been surfaced previously. They are provided ONLY so you can avoid producing duplicates. Do not treat them as evidence, starting hypotheses, or confirmed findings. Reason fresh from vault data.`;

const FULL_FRAMING = `Insights previously surfaced to the user. These are conversational context, not evidence. When citing claims, cite raw vault data — not these insights.`;

export function insightSlug(insight: Insight): string {
  return `insight:${formatISODate(insight.generatedAt) ?? "unknown"}`;
}

export function serializeInsights(
  insights: readonly Insight[],
  mode: InsightSerializationMode,
  slugIndex: SlugIndex,
): string {
  if (insights.length === 0) return "";

  const sorted = insights.slice().sort((a, b) => {
    const ta = a.generatedAt.getTime();
    const tb = b.generatedAt.getTime();
    if (ta !== tb) return tb - ta;
    return compareById(a, b);
  });

  const lines: string[] = ["# Prior Insights (for context only — not evidence)", ""];
  lines.push(mode === "deduplication-only" ? DEDUP_FRAMING : FULL_FRAMING);
  lines.push("");

  for (const i of sorted) {
    const slug = slugIndex.get(i.id) ?? insightSlug(i);
    lines.push(`## § ${slug}`);
    lines.push("");
    lines.push(`- Generated: ${formatISODate(i.generatedAt)}`);
    lines.push(`- Title: ${i.title}`);
    lines.push(`- Category: ${i.category}`);
    lines.push(`- Severity: ${i.severity}`);
    lines.push(`- Status: ${i.status}`);
    lines.push(`- Body:`);
    lines.push(i.body);

    if (i.citedSources.length > 0) {
      const cites = i.citedSources
        .map((s) => citationFor(s.id, slugIndex))
        .filter((c): c is string => c !== null);
      if (cites.length > 0) {
        lines.push(`- Cites: ${cites.join(" ")}`);
      }
    }
    if (i.externalRefs && i.externalRefs.length > 0) {
      const sortedRefs = i.externalRefs
        .slice()
        .sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
      lines.push(
        `- External refs: ${sortedRefs.map((r) => `↗ ${r.title} (${r.url})`).join(" ")}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
