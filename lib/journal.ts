import type { JournalEntry } from "@/db/schema";

/**
 * Display helpers for journal entries — single source for the §6.7:1535
 * `(untitled)` / first-line-preview rules, shared across the timeline card,
 * detail header, breadcrumb, and the "other entries this month" reference rows.
 */

/** First non-empty line of the markdown body, stripped of leading `#`/`>`/`-`. */
export function journalFirstLine(content: string, max = 80): string {
  const line =
    content
      .split("\n")
      .map((l) => l.replace(/^\s*[#>*-]+\s*/, "").trim())
      .find((l) => l.length > 0) ?? "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** Title for the detail header / breadcrumb: the title, or `(untitled)`. */
export function journalDisplayTitle(entry: Pick<JournalEntry, "title">): string {
  return entry.title?.trim() || "(untitled)";
}

/**
 * Label for a reference TO an entry (linked-context sibling rows): the title
 * if present, else a first-line preview, else `(untitled)` (§6.7:1535).
 */
export function journalReferenceLabel(
  entry: Pick<JournalEntry, "title" | "content">,
): string {
  const title = entry.title?.trim();
  if (title) return title;
  const firstLine = journalFirstLine(entry.content);
  return firstLine || "(untitled)";
}
