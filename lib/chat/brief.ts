/**
 * Doctor-brief marker contract (design.md 5.7, Phase E item E7).
 *
 * The synthesis prompt's brief-mode addendum instructs the model to open every
 * brief — and only a brief — with an HTML-comment marker on its own first line:
 *
 *   <!-- arogya:brief:delta -->
 *   <!-- arogya:brief:handoff -->
 *
 * react-markdown drops raw-HTML nodes by default, so the marker is invisible in
 * chat while giving both sides a deterministic detector: the conversation pane
 * uses it to attach the `Download PDF` action, and the brief-pdf route uses it
 * to locate brief messages inside a persisted session. Shared here (no server
 * imports) so client and route can't drift on the syntax.
 */

export type BriefMode = "delta" | "handoff";

const BRIEF_MARKER_RE = /^\s*<!--\s*arogya:brief:(delta|handoff)\s*-->/;

/** The brief mode a message declares, or null when the message is not a brief. */
export function briefModeOf(text: string): BriefMode | null {
  const match = BRIEF_MARKER_RE.exec(text);
  if (!match) return null;
  return match[1] === "delta" ? "delta" : "handoff";
}

/** Message body with the marker line removed (for rendering/export pipelines). */
export function stripBriefMarker(text: string): string {
  return text.replace(BRIEF_MARKER_RE, "").replace(/^\s*\n/, "");
}

const MARKER_FORMS = [
  "<!-- arogya:brief:delta -->",
  "<!-- arogya:brief:handoff -->",
];

/**
 * Display variant: also hides a first line that is a partial PREFIX of the
 * marker — react-markdown renders comment text literally (no rehype-raw), so
 * without this the marker flashes character-by-character while the brief
 * streams, then again in full once complete.
 */
export function stripBriefMarkerForDisplay(text: string): string {
  const nl = text.indexOf("\n");
  const firstLine = (nl === -1 ? text : text.slice(0, nl)).trim();
  if (firstLine.length === 0) return text;
  const isMarker =
    briefModeOf(firstLine) !== null ||
    MARKER_FORMS.some((form) => form.startsWith(firstLine));
  if (!isMarker) return text;
  return nl === -1 ? "" : text.slice(nl + 1).replace(/^\s*\n/, "");
}
