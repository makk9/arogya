"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { useMaybeLifestyleLogChange } from "@/components/lifestyle/lifestyle-log-change-context";
import { Button } from "@/components/ui/button";

interface Props {
  totalCount: number;
  recentEntries: ReactNode;
  // null when totalCount <= 5 (collapse affordance not rendered).
  olderEntries: ReactNode | null;
}

/*
 * History section client island — "the trend story" (§6.5:1403), the
 * demo-relevant half of the Lifestyle page. Owns the `Show all` / `Hide`
 * toggle; the `+ Log a change` button reads its onClick from
 * LifestyleLogChangeContext. Clones allergy-history-section.tsx.
 */
export function LifestyleHistorySection({
  totalCount,
  recentEntries,
  olderEntries,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const logChange = useMaybeLifestyleLogChange();
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
