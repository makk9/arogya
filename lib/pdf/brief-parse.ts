import { briefModeOf, stripBriefMarker, type BriefMode } from "@/lib/chat/brief";
import { tokenizeCitations } from "@/lib/citations/parse";

/**
 * Brief message → structured document for the PDF template (design.md 5.7).
 *
 * The synthesis prompt locks the brief's shape (marker line → **Label:** value
 * metadata block → `## SECTION` headings with flat `- ` bullets), so this
 * parser is intentionally small: split on those forms, strip citation glyphs
 * (5.7: citations are visible in chat, stripped from the PDF), and degrade
 * gracefully — an off-format line still renders as a paragraph rather than
 * being dropped, so prompt drift can never silently lose clinical content.
 */

export interface BriefRun {
  text: string;
  bold: boolean;
}

export interface BriefBlock {
  kind: "bullet" | "paragraph";
  runs: BriefRun[];
}

export interface BriefSection {
  title: string;
  blocks: BriefBlock[];
}

export interface BriefMetaRow {
  label: string;
  value: string;
}

export interface BriefDoc {
  mode: BriefMode;
  meta: BriefMetaRow[];
  /** Off-format content before the first section heading (empty when the model followed the format). */
  preamble: BriefBlock[];
  sections: BriefSection[];
}

// Serializer slugs can carry extra colon groups (`lab-result:ldl:2026-03-01`)
// and underscores (`vital:blood_pressure:2026-04-01`) that the tokenizer —
// whose slug charset has neither a second `:` nor `_` — leaves behind as a
// dangling `_pressure:2026-04-01`-style text remainder after the citation
// segment. Swallow that remainder when it immediately follows a removed
// citation.
const DANGLING_SLUG_TAIL_RE = /^(?:[:_][a-z0-9/-]+)+/;

/**
 * Remove `§`/`↗` citation glyphs from one line of text and tidy the wound:
 * collapse doubled spaces, drop parens/brackets left empty by the removal, and
 * unstick space-before-punctuation.
 */
export function stripCitations(line: string): string {
  const segments = tokenizeCitations(line);
  const withoutCitations = segments
    .map((seg, i) => {
      if (seg.kind !== "text") return "";
      const prev = segments[i - 1];
      return prev && prev.kind === "vault"
        ? seg.text.replace(DANGLING_SLUG_TAIL_RE, "")
        : seg.text;
    })
    .join("");
  return (
    withoutCitations
      // Parens/brackets left holding only separators — "(, , )" from a removed
      // "(§ a, § b)" group — then comma runs from removed inline citation lists.
      .replace(/[([]\s*(?:[,;·]\s*)*[)\]]/g, "")
      .replace(/(?:\s*,){2,}/g, ",")
      .replace(/,\s*([.;:!?)\]])/g, "$1")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/ +([.,;:!?])/g, "$1")
      .trim()
  );
}

// **bold** spans → runs. Unpaired `**` is left literal.
function parseRuns(text: string): BriefRun[] {
  const runs: BriefRun[] = [];
  const parts = text.split(/\*\*([^*]+)\*\*/);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.length === 0) continue;
    runs.push({ text: part, bold: i % 2 === 1 });
  }
  return runs;
}

const HEADING_RE = /^#{1,6}\s+(.*)$/;
const BULLET_RE = /^[-*]\s+(.*)$/;
const META_RE = /^\*\*([^*]+):\*\*\s*(.*)$/;

function blockOf(line: string): BriefBlock | null {
  const bullet = BULLET_RE.exec(line);
  const body = stripCitations(bullet ? bullet[1] : line);
  if (body.length === 0) return null;
  return { kind: bullet ? "bullet" : "paragraph", runs: parseRuns(body) };
}

/** Parse a brief message body. Returns null when the marker is absent (not a brief). */
export function parseBrief(raw: string): BriefDoc | null {
  const mode = briefModeOf(raw);
  if (mode === null) return null;

  const doc: BriefDoc = { mode, meta: [], preamble: [], sections: [] };
  let current: BriefSection | null = null;

  for (const rawLine of stripBriefMarker(raw).split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;

    const heading = HEADING_RE.exec(line);
    if (heading) {
      current = { title: stripCitations(heading[1]), blocks: [] };
      doc.sections.push(current);
      continue;
    }

    // Metadata rows only occur before the first section per the locked format.
    if (current === null) {
      const meta = META_RE.exec(line);
      if (meta) {
        doc.meta.push({ label: meta[1].trim(), value: stripCitations(meta[2]) });
        continue;
      }
    }

    const block = blockOf(line);
    if (block === null) continue;
    if (current === null) doc.preamble.push(block);
    else current.blocks.push(block);
  }

  return doc;
}
