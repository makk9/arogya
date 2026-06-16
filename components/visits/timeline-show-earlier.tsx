"use client";

import { useState } from "react";

/*
 * §6.6 pagination affordance: "Show N earlier [entity] ▾" at the bottom of a
 * timeline — no infinite scroll. The earlier sections are server-rendered and
 * passed as children; this island only owns the revealed flag (one-way: once
 * shown, they stay shown for the session).
 */

interface TimelineShowEarlierProps {
  hiddenCount: number;
  /** Entity noun, e.g. "visits". */
  noun: string;
  children: React.ReactNode;
}

export function TimelineShowEarlier({
  hiddenCount,
  noun,
  children,
}: TimelineShowEarlierProps) {
  const [shown, setShown] = useState(false);

  if (shown) return <>{children}</>;

  return (
    <button
      type="button"
      onClick={() => setShown(true)}
      className="w-full rounded-lg border border-dashed border-border px-4 py-3 text-center font-mono text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
    >
      Show {hiddenCount} earlier {noun} ▾
    </button>
  );
}
