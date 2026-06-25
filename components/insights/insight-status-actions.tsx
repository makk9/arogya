"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { insightStatus } from "@/db/schema";

type Status = (typeof insightStatus.enumValues)[number];

/*
 * Insight detail status actions per §6.9:1607/1640. Status-change buttons are
 * prominent (not in a `…` menu): `✓ Acknowledge`, `→ Mark acted on`, `✕ Dismiss`.
 * The button matching the current status renders disabled (§6.9 "current status
 * greyed/inactive"). A `Restore` affordance appears once the insight is in a
 * resolved state (acknowledged / acted_on / dismissed) and reverts it to `seen`.
 *
 * Visual weight by use frequency, NO green (Phase 7.3 — green dropped from the
 * system): `Mark acted on` (highest-value action) gets the periwinkle `default`
 * fill; the others are neutral `outline`. Differentiation is label + the one
 * primary fill, not color-coding.
 *
 * PATCH /api/insights/[id] { status } → on success refresh the server component
 * so the header subtitle + button states re-render from the new status.
 */

const RESOLVED: ReadonlySet<Status> = new Set<Status>([
  "acknowledged",
  "acted_on",
  "dismissed",
]);

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export function InsightStatusActions({
  insightId,
  status,
}: {
  insightId: string;
  status: Status;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = pending !== null;

  async function setStatus(next: Status) {
    setError(null);
    setPending(next);

    let res: Response;
    try {
      res = await fetch(`/api/insights/${insightId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
    } catch {
      setError("Couldn't reach the server. Try again.");
      setPending(null);
      return;
    }

    if (res.ok) {
      router.refresh();
      setPending(null);
      return;
    }

    const parsed = (await res.json().catch(() => ({}))) as ApiErrorBody;
    setError(parsed.error?.message ?? "Couldn't update. Try again.");
    setPending(null);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || status === "acknowledged"}
          onClick={() => void setStatus("acknowledged")}
        >
          ✓ Acknowledge
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={busy || status === "acted_on"}
          onClick={() => void setStatus("acted_on")}
        >
          → Mark acted on
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || status === "dismissed"}
          onClick={() => void setStatus("dismissed")}
        >
          ✕ Dismiss
        </Button>
        {RESOLVED.has(status) ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => void setStatus("seen")}
          >
            Restore
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
