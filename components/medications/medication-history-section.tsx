"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { useMaybeMedicationLogChange } from "@/components/medications/medication-log-change-context";
import { Button } from "@/components/ui/button";

interface Props {
  totalCount: number;
  recentEntries: ReactNode;
  // null when totalCount <= 5 (collapse affordance not rendered).
  // Locked refinement: collapse only when changes > 5; otherwise show all.
  olderEntries: ReactNode | null;
}

/*
 * History section client island. Owns the `Show all` / `Hide` toggle.
 * The `+ Log a change` button reads its onClick from
 * MedicationLogChangeContext — when the provider is absent (med is
 * discontinued, per the shell) the button is hidden.
 *
 * Per locked refinement, the Show-all affordance only appears when there are
 * more than 5 changes — most medications have 0-3 changes and don't need an
 * unnecessary toggle. Empty-history copy renders inline alongside the button
 * so users discover the affordance.
 */
export function MedicationHistorySection({
  totalCount,
  recentEntries,
  olderEntries,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const logChange = useMaybeMedicationLogChange();
  const hasOlder = olderEntries !== null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          History
        </h2>
        {logChange ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => logChange.open()}
          >
            + Log a change
          </Button>
        ) : null}
      </div>
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
