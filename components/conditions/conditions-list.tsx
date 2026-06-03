"use client";

import { useState } from "react";

interface ConditionsListProps {
  activeCards: React.ReactNode;
  controlledCards: React.ReactNode;
  inRemissionCards: React.ReactNode;
  resolvedCards: React.ReactNode;
  suspectedCards: React.ReactNode;
  activeCount: number;
  controlledCount: number;
  inRemissionCount: number;
  resolvedCount: number;
  suspectedCount: number;
}

/*
 * Section-grouped list shell per design.md 6.4. Cards are passed in as
 * ReactNode children — they stay RSCs rendered upstream on the server, and this
 * client island only owns collapse state. Open-defaults per 6.4:1334: ACTIVE and
 * CONTROLLED expanded; IN_REMISSION / RESOLVED / SUSPECTED collapsed. Collapse
 * is session-only (resets on navigation); URL stays clean. Clones
 * medications-list.tsx with five buckets instead of three.
 *
 * Sections with count 0 don't render — handles both natural emptiness and the
 * category filter (parent passes 0 counts for buckets with no matches).
 */
export function ConditionsList({
  activeCards,
  controlledCards,
  inRemissionCards,
  resolvedCards,
  suspectedCards,
  activeCount,
  controlledCount,
  inRemissionCount,
  resolvedCount,
  suspectedCount,
}: ConditionsListProps) {
  const [activeOpen, setActiveOpen] = useState(true);
  const [controlledOpen, setControlledOpen] = useState(true);
  const [inRemissionOpen, setInRemissionOpen] = useState(false);
  const [resolvedOpen, setResolvedOpen] = useState(false);
  const [suspectedOpen, setSuspectedOpen] = useState(false);

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
      {controlledCount > 0 ? (
        <Section
          slug="controlled"
          label="Controlled"
          count={controlledCount}
          open={controlledOpen}
          onToggle={() => setControlledOpen((v) => !v)}
        >
          {controlledCards}
        </Section>
      ) : null}
      {inRemissionCount > 0 ? (
        <Section
          slug="in-remission"
          label="In remission"
          count={inRemissionCount}
          open={inRemissionOpen}
          onToggle={() => setInRemissionOpen((v) => !v)}
        >
          {inRemissionCards}
        </Section>
      ) : null}
      {resolvedCount > 0 ? (
        <Section
          slug="resolved"
          label="Resolved"
          count={resolvedCount}
          open={resolvedOpen}
          onToggle={() => setResolvedOpen((v) => !v)}
        >
          {resolvedCards}
        </Section>
      ) : null}
      {suspectedCount > 0 ? (
        <Section
          slug="suspected"
          label="Suspected"
          count={suspectedCount}
          open={suspectedOpen}
          onToggle={() => setSuspectedOpen((v) => !v)}
        >
          {suspectedCards}
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
  const panelId = `conditions-section-${slug}`;
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
