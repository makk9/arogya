import type { SymptomEpisode, SymptomType } from "@/db/schema";

import {
  citationFor,
  compareById,
  formatISODate,
  formatISOTimestamp,
  slugify,
  type SlugIndex,
} from "./format";

const TYPE_STATUS_ORDER = ["active", "monitoring", "resolved"] as const;

export function symptomTypeSlug(type: SymptomType): string {
  return `symptom:${slugify(type.name)}`;
}

export function symptomEpisodeSlug(episode: SymptomEpisode): string {
  return `symptom-episode:${formatISODate(episode.startedAt) ?? "unknown"}`;
}

export function serializeSymptoms(
  types: readonly SymptomType[],
  episodes: readonly SymptomEpisode[],
  slugIndex: SlugIndex,
): string {
  if (types.length === 0 && episodes.length === 0) return "";

  const sortedTypes = types.slice().sort((a, b) => {
    const sa = TYPE_STATUS_ORDER.indexOf(a.status);
    const sb = TYPE_STATUS_ORDER.indexOf(b.status);
    if (sa !== sb) return sa - sb;
    const da = a.firstNoted ? new Date(a.firstNoted).getTime() : 0;
    const db = b.firstNoted ? new Date(b.firstNoted).getTime() : 0;
    if (da !== db) return db - da;
    return compareById(a, b);
  });

  const episodesByType = new Map<string, SymptomEpisode[]>();
  for (const e of episodes) {
    const list = episodesByType.get(e.symptomTypeId) ?? [];
    list.push(e);
    episodesByType.set(e.symptomTypeId, list);
  }

  const lines: string[] = ["# Recent Symptoms", ""];

  for (const t of sortedTypes) {
    lines.push(`## § ${symptomTypeSlug(t)}`);
    lines.push("");
    lines.push(`- Name: ${t.name}`);
    lines.push(`- Status: ${t.status}`);
    if (t.bodyArea) lines.push(`- Body area: ${t.bodyArea}`);
    if (t.firstNoted) lines.push(`- First noted: ${formatISODate(t.firstNoted)}`);
    const linkedCondition = citationFor(t.linkedCondition, slugIndex);
    if (linkedCondition) lines.push(`- Linked condition: ${linkedCondition}`);
    if (t.notes) lines.push(`- Notes: ${t.notes}`);

    const typeEpisodes = (episodesByType.get(t.id) ?? [])
      .slice()
      .sort((a, b) => {
        const ta = a.startedAt.getTime();
        const tb = b.startedAt.getTime();
        if (ta !== tb) return tb - ta;
        return compareById(a, b);
      });
    if (typeEpisodes.length > 0) {
      lines.push("");
      lines.push("### Episodes");
      for (const e of typeEpisodes) {
        const slug = slugIndex.get(e.id) ?? symptomEpisodeSlug(e);
        const ended = e.endedAt ? ` → ${formatISOTimestamp(e.endedAt)}` : "";
        const duration = e.durationMinutes !== null
          ? ` (${e.durationMinutes} min)`
          : "";
        const severity = e.severity ? `, ${e.severity}` : "";
        const desc = e.description ? ` — ${e.description}` : "";
        const linkedVisit = citationFor(e.linkedVisitId, slugIndex);
        const linkedVisitTail = linkedVisit ? `, ${linkedVisit}` : "";
        const linkedVitals =
          e.linkedVitalIds && e.linkedVitalIds.length > 0
            ? `, linked vitals: ${e.linkedVitalIds
                .map((id) => citationFor(id, slugIndex))
                .filter((c): c is string => c !== null)
                .join(" ")}`
            : "";
        lines.push(
          `- § ${slug} — ${formatISOTimestamp(e.startedAt)}${ended}${duration}${severity}${desc}${linkedVisitTail}${linkedVitals}`,
        );
        if (e.triggers) lines.push(`  - Triggers: ${e.triggers}`);
        if (e.relief) lines.push(`  - Relief: ${e.relief}`);
        if (e.notes) lines.push(`  - Notes: ${e.notes}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
