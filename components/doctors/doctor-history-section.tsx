"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { useMaybeDoctorLogChange } from "@/components/doctors/doctor-log-change-context";
import { Button } from "@/components/ui/button";

interface Props {
  totalCount: number;
  recentEntries: ReactNode;
  // null when totalCount <= 5 (collapse affordance not rendered).
  olderEntries: ReactNode | null;
}

/*
 * History section client island. Clones condition-history-section.tsx. §6.5
 * expects Doctor history to be "rare changes (often empty section)" — the
 * empty copy renders inline alongside the always-available button.
 */
export function DoctorHistorySection({
  totalCount,
  recentEntries,
  olderEntries,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const logChange = useMaybeDoctorLogChange();
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
            onClick={logChange.open}
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
