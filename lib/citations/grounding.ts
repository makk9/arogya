import { tokenizeCitations } from "./parse";

/**
 * Derives the "grounded in" set for a chat message or whole conversation by
 * tokenizing assistant text and collecting its citation pills (design.md
 * 6.2:1192 conversation header, 6.2:1207 per-message footer).
 *
 * Grounding is DERIVED, never stored — same contract as wiki backlinks
 * (CLAUDE.md tripwire). The citation glyphs already live inline in the message
 * text; this just dedupes them into a scannable strip.
 */

export interface GroundingRef {
  // Dedup + React key. `${entityType}:${slug ?? ""}` for vault, `ext:${name}`
  // for external — so the same entity cited twice collapses to one chip.
  key: string;
  kind: "vault" | "external";
  // Vault only.
  entityType?: string;
  slug?: string | null;
  // External only.
  sourceName?: string;
  // The reconstructed glyph form (`§ med:amlodipine` / `↗ NIH`) used as the
  // chip's visible label, identical to the inline pill text.
  label: string;
}

export interface Grounding {
  vault: GroundingRef[];
  external: GroundingRef[];
}

function refsFromText(text: string, into: Map<string, GroundingRef>): void {
  for (const seg of tokenizeCitations(text)) {
    if (seg.kind === "vault") {
      const key = `${seg.entityType}:${seg.slug ?? ""}`;
      if (!into.has(key)) {
        into.set(key, {
          key,
          kind: "vault",
          entityType: seg.entityType,
          slug: seg.slug,
          label: seg.slug
            ? `§ ${seg.entityType}:${seg.slug}`
            : `§ ${seg.entityType}`,
        });
      }
    } else if (seg.kind === "external") {
      const key = `ext:${seg.sourceName}`;
      if (!into.has(key)) {
        into.set(key, {
          key,
          kind: "external",
          sourceName: seg.sourceName,
          label: `↗ ${seg.sourceName}`,
        });
      }
    }
  }
}

/** Grounding for a single assistant message — backs the per-message footer. */
export function groundingFromText(text: string): Grounding {
  const map = new Map<string, GroundingRef>();
  refsFromText(text, map);
  const all = [...map.values()];
  const vault = all.filter((r) => r.kind === "vault");
  const external = all.filter((r) => r.kind === "external");
  return { vault, external };
}
