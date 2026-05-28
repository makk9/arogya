"use client";

import { useState } from "react";

interface MedicationsListProps {
  activeCards: React.ReactNode;
  pausedCards: React.ReactNode;
  discontinuedCards: React.ReactNode;
  activeCount: number;
  pausedCount: number;
  discontinuedCount: number;
}

/*
 * Section-grouped list shell per design.md 6.4. Cards are passed in as
 * ReactNode children — they remain RSCs rendered upstream on the server, and
 * this client island only owns the collapse state. Defaults per plan D4:
 * ACTIVE expanded, PAUSED collapsed, DISCONTINUED collapsed. Section
 * collapse is session-only (resets on navigation); URL stays clean.
 *
 * Sections with count 0 don't render — handles both natural emptiness and
 * the `Active only` filter (parent passes 0 counts for hidden buckets).
 */
export function MedicationsList({
  activeCards,
  pausedCards,
  discontinuedCards,
  activeCount,
  pausedCount,
  discontinuedCount,
}: MedicationsListProps) {
  const [activeOpen, setActiveOpen] = useState(true);
  const [pausedOpen, setPausedOpen] = useState(false);
  const [discontinuedOpen, setDiscontinuedOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {activeCount > 0 ? (
        <Section
          slug="active"
          label="Active"
          count={activeCount}
          open={activeOpen}
          onToggle={() => setActiveOpen((v) => !v)}
        >
          {activeCards}
        </Section>
      ) : null}
      {pausedCount > 0 ? (
        <Section
          slug="paused"
          label="Paused"
          count={pausedCount}
          open={pausedOpen}
          onToggle={() => setPausedOpen((v) => !v)}
        >
          {pausedCards}
        </Section>
      ) : null}
      {discontinuedCount > 0 ? (
        <Section
          slug="discontinued"
          label="Discontinued"
          count={discontinuedCount}
          open={discontinuedOpen}
          onToggle={() => setDiscontinuedOpen((v) => !v)}
        >
          {discontinuedCards}
        </Section>
      ) : null}
    </div>
  );
}

interface SectionProps {
  slug: string;
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Section({ slug, label, count, open, onToggle, children }: SectionProps) {
  const panelId = `medications-section-${slug}`;
  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center gap-2 font-mono text-[0.7rem] uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
      >
        <span>
          {label} · {count}
        </span>
        <span aria-hidden>{open ? "▾" : "▶"}</span>
      </button>
      {open ? (
        <div id={panelId} className="mt-3 flex flex-col gap-2">
          {children}
        </div>
      ) : null}
    </section>
  );
}
