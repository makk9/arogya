/**
 * Pure tokenizer for arogya's citation pill syntax. No React, no markdown library —
 * splits a text fragment into citation + interleaved text segments.
 *
 * Citation forms recognized (per design.md 10.3:3084 + 5.3:728-732 + 6.9:1626/1634):
 *   §  vault citation:    "§ entity-type"            (type-only reference)
 *                         "§ entity-type:slug"       (specific entity)
 *                         "§ entity-type: slug"      (space variant, tolerated)
 *                         "§ entity-type: slug/sub"  (date suffix per 6.9:1634, v1.5 form — tolerated)
 *                         "§ entity-type:part:part"  (compound slugs — serializers emit
 *                            `vital:blood_pressure:2026-07-22` and `lab-result:<marker>:<date>`;
 *                            the whole compound is the slug, incl. snake_case parts)
 *   ↗  external citation: "↗ source-name"            (terminates at sentence punctuation / ')' / newline / EOS)
 *
 * The tokenizer is the load-bearing contract with the serializer side
 * (`citationFor()` in lib/agents/_shared/serializers/format.ts) — every string the
 * serializer emits must round-trip through tokenizeCitations() back to a `vault`
 * segment with matching entityType + slug. The smoke runner asserts this directly.
 */

export type CitationSegment =
  | { kind: "text"; text: string }
  | { kind: "vault"; entityType: string; slug: string | null; raw: string }
  | { kind: "external"; sourceName: string; raw: string };

// One alternation with two capturing groups for the vault form (entityType + optional slug)
// and one capturing group for the external form. `g` so we can drive with matchAll.
// Entity-type charset matches `slugify()` output in format.ts:3-11 — lowercase alnum +
// hyphen. The slug additionally allows `_` (vital slugs embed snake_case reading types),
// `/` for v1.5 date-suffix tolerance per 6.9:1634, and further `:`-joined parts
// (`blood_pressure:2026-07-22`, `<marker>:<date>`) — each extra colon must be followed
// by another slug chunk, so a sentence colon after the citation is never captured.
// External form terminates at sentence punctuation, `)`, newline, EOS, or the next
// citation glyph (`§` / `↗`). The `\s*` in the lookahead absorbs trailing whitespace
// so it isn't captured into `raw` — keeps adjacent externals from gluing together.
const CITATION_RE =
  /§\s*([a-z][a-z0-9-]*)(?:\s*:\s*([a-z0-9_/-]+(?::[a-z0-9_/-]+)*))?|↗\s+([^.,;!?)\n§↗]+?)(?=\s*(?:[.,;!?)\n§↗]|$))/gu;

export function tokenizeCitations(input: string): CitationSegment[] {
  if (input.length === 0) return [];

  const segments: CitationSegment[] = [];
  let cursor = 0;

  for (const match of input.matchAll(CITATION_RE)) {
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;

    if (matchStart > cursor) {
      pushText(segments, input.slice(cursor, matchStart));
    }

    const [raw, vaultType, vaultSlug, externalName] = match;
    if (vaultType !== undefined) {
      segments.push({
        kind: "vault",
        entityType: vaultType,
        slug: vaultSlug ?? null,
        raw,
      });
    } else if (externalName !== undefined) {
      segments.push({
        kind: "external",
        sourceName: externalName.trim(),
        raw,
      });
    }

    cursor = matchEnd;
  }

  if (cursor < input.length) {
    pushText(segments, input.slice(cursor));
  }

  return segments;
}

// Adjacent text segments collapse — when the tokenizer is run repeatedly across an
// mdast tree, callers expect a clean shape with no zero-length or back-to-back text.
function pushText(segments: CitationSegment[], text: string): void {
  if (text.length === 0) return;
  const last = segments[segments.length - 1];
  if (last && last.kind === "text") {
    last.text += text;
    return;
  }
  segments.push({ kind: "text", text });
}
