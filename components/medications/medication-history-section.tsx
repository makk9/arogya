"use client";

import { useState } from "react";
import type { ReactNode } from "react";

interface Props {
  totalCount: number;
  recentEntries: ReactNode;
  // null when totalCount <= 5 (collapse affordance not rendered).
  // Locked refinement: collapse only when changes > 5; otherwise show all.
  olderEntries: ReactNode | null;
}

/*
 * History section client island. Owns the `Show all` / `Hide` toggle.
 * Per locked refinement, the collapse affordance only appears when there
 * are more than 5 changes — most medications have 0-3 changes and don't
 * need an unnecessary toggle. Empty-history copy renders inline.
 */
export function MedicationHistorySection({
  totalCount,
  recentEntries,
  olderEntries,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const hasOlder = olderEntries !== null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        History
      </h2>
      {totalCount === 0 ? (
        <p className="text-sm italic text-muted-foreground">
          No changes logged yet.
        </p>
      ) : (
        <>
          <div className="space-y-1">
            {recentEntries}
            {hasOlder && expanded ? olderEntries : null}
          </div>
          {hasOlder ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 text-xs text-muted-foreground hover:text-foreground"
            >
              {expanded ? "Hide ▴" : `+ Show all ${totalCount} changes ▾`}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
