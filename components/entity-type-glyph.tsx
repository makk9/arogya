/*
 * Single-letter entity-type glyph per design.md §6.5:1410 — "typed pills with
 * single-letter avatar prefixes" (`D Dr Sharma · cardio`, `V Visit · Apr 3`).
 * Rendered as a small circled badge rather than a bare letter so it reads as a
 * deliberate type marker, not a typo (user feedback, 2026-06-10). The `§`
 * vault-reference prefix keeps its plain-glyph treatment — it's a symbol, not
 * a letter, and matches the citation pills.
 *
 * Decorative (aria-hidden): the text beside it already names the entity.
 */
export function EntityTypeGlyph({ letter }: { letter: "D" | "V" }) {
  return (
    <span
      aria-hidden
      className="mr-1.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-muted align-[-0.125em] font-mono text-[0.625rem] leading-none text-muted-foreground ring-1 ring-border"
    >
      {letter}
    </span>
  );
}
