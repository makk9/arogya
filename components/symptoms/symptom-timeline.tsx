"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

/*
 * The §6.6 Symptoms timeline body — grouped by symptom type, NOT by month
 * (unique to this rail item). Each group is a collapsible section
 * (`DIZZINESS · 12 episodes ▾`); active types render expanded, others
 * collapsed — collapse state is session-only. Within a group, the first
 * PER_GROUP_VISIBLE episode cards show and the rest hide behind a per-group
 * "+ Show N earlier episodes ▾" (§6.6 — no infinite scroll).
 *
 * Episode cards are server-rendered RSCs passed in as `cards` (newest first);
 * this island owns only the open map + the per-group reveal flags. The group
 * header carries a separate link to the SymptomType detail page (the parent
 * surface) alongside the collapse toggle.
 */

const PER_GROUP_VISIBLE = 5;

export interface SymptomTypeGroup {
  typeId: string;
  name: string;
  status: string;
  episodeCount: number;
  defaultOpen: boolean;
  typeHref: string;
  cards: ReactNode[];
}

export function SymptomTimeline({ groups }: { groups: SymptomTypeGroup[] }) {
  const [openByType, setOpenByType] = useState<Record<string, boolean>>({});
  const [expandedByType, setExpandedByType] = useState<Record<string, boolean>>(
    {},
  );

  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => {
        const open = openByType[g.typeId] ?? g.defaultOpen;
        const showAll = expandedByType[g.typeId] ?? false;
        const panelId = `symptoms-group-${g.typeId}`;
        const hiddenCount = g.cards.length - PER_GROUP_VISIBLE;
        const visibleCards =
          showAll || hiddenCount <= 0
            ? g.cards
            : g.cards.slice(0, PER_GROUP_VISIBLE);

        return (
          <section key={g.typeId}>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() =>
                  setOpenByType((prev) => ({ ...prev, [g.typeId]: !open }))
                }
                className="flex min-w-0 items-center gap-2 font-mono text-[0.7rem] uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="truncate">
                  {g.name} · {g.episodeCount}{" "}
                  {g.episodeCount === 1 ? "episode" : "episodes"}
                </span>
                <span aria-hidden>{open ? "▾" : "▶"}</span>
              </button>
              <Link
                href={g.typeHref}
                className="shrink-0 font-mono text-[0.7rem] text-link underline-offset-4 hover:underline"
              >
                View symptom →
              </Link>
            </div>

            {open ? (
              <div id={panelId} className="mt-3 flex flex-col gap-2">
                {visibleCards}
                {!showAll && hiddenCount > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedByType((prev) => ({ ...prev, [g.typeId]: true }))
                    }
                    className="w-full rounded-lg border border-dashed border-border px-4 py-2.5 text-center font-mono text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                  >
                    + Show {hiddenCount} earlier{" "}
                    {hiddenCount === 1 ? "episode" : "episodes"} ▾
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
