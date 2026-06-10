"use client";

import { useState } from "react";

/*
 * Shared section-grouped list shell per design.md 6.4 — the one page-shell,
 * per-entity card rendering pattern. Extracted at the third list copy (E2:
 * Medications → Conditions → Doctors); the per-entity *Card components stay
 * separate, this owns only the section headers + collapse state.
 *
 * Cards are passed in as ReactNode — they remain RSCs rendered upstream on the
 * server; this client island owns nothing but the open/closed map. Collapse is
 * session-only (resets on navigation); URL stays clean.
 *
 * Sections are data, not props-per-bucket, because Doctors group by free-text
 * specialty — the bucket set isn't known at compile time. Open state is keyed
 * by slug and falls back to `defaultOpen` for sections that appear after mount
 * (e.g. a filter being cleared).
 *
 * Sections with count 0 don't render — handles both natural emptiness and
 * filters (parents pass 0 counts for hidden buckets).
 */

export interface EntityListSection {
  /** Stable key + aria panel-id fragment (lowercase, hyphenated). */
  slug: string;
  /** Header text; rendered uppercase via CSS. */
  label: string;
  count: number;
  defaultOpen: boolean;
  cards: React.ReactNode;
}

interface Props {
  /** Entity namespace for aria panel ids, e.g. "medications". */
  idPrefix: string;
  sections: ReadonlyArray<EntityListSection>;
}

export function EntityListSections({ idPrefix, sections }: Props) {
  const [openBySlug, setOpenBySlug] = useState<Record<string, boolean>>({});

  return (
    <div className="flex flex-col gap-6">
      {sections
        .filter((s) => s.count > 0)
        .map((s) => {
          const open = openBySlug[s.slug] ?? s.defaultOpen;
          const panelId = `${idPrefix}-section-${s.slug}`;
          return (
            <section key={s.slug}>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() =>
                  setOpenBySlug((prev) => ({ ...prev, [s.slug]: !open }))
                }
                className="flex w-full items-center gap-2 font-mono text-[0.7rem] uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
              >
                <span>
                  {s.label} · {s.count}
                </span>
                <span aria-hidden>{open ? "▾" : "▶"}</span>
              </button>
              {open ? (
                <div id={panelId} className="mt-3 flex flex-col gap-2">
                  {s.cards}
                </div>
              ) : null}
            </section>
          );
        })}
    </div>
  );
}
