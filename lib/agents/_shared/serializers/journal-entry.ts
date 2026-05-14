import type { JournalEntry } from "@/db/schema";

import {
  citationFor,
  compareById,
  formatISODate,
  type SlugIndex,
} from "./format";

export function journalEntrySlug(entry: JournalEntry): string {
  return `journal:${formatISODate(entry.entryDate) ?? "unknown"}`;
}

export function serializeJournalEntries(
  entries: readonly JournalEntry[],
  slugIndex: SlugIndex,
): string {
  if (entries.length === 0) return "";

  const sorted = entries.slice().sort((a, b) => {
    const da = new Date(a.entryDate).getTime();
    const db = new Date(b.entryDate).getTime();
    if (da !== db) return db - da;
    return compareById(a, b);
  });

  const lines: string[] = ["# Recent Journal Entries", ""];

  for (const e of sorted) {
    const slug = slugIndex.get(e.id) ?? journalEntrySlug(e);
    lines.push(`## § ${slug}`);
    lines.push("");
    lines.push(`- Date: ${formatISODate(e.entryDate)}`);
    if (e.title) lines.push(`- Title: ${e.title}`);
    if (e.mood) lines.push(`- Mood: ${e.mood}`);
    if (e.linkedEntities && e.linkedEntities.length > 0) {
      const cites = e.linkedEntities
        .map((ref) => citationFor(ref.id, slugIndex))
        .filter((c): c is string => c !== null);
      if (cites.length > 0) {
        lines.push(`- Linked: ${cites.join(" ")}`);
      }
    }
    lines.push(`- Content:`);
    lines.push(e.content);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
