"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { LivePatientPanel } from "@/components/onboarding/live-patient-panel";
import { OnboardingChat } from "@/components/onboarding/onboarding-chat";
import type { OnboardingMessage, OnboardingPhase } from "@/db/schema";
import type { OnboardingSnapshot } from "@/lib/onboarding/snapshot";

/**
 * The onboarding interview surface (§6.3) — 50/50 split, conversation left,
 * live-populating patient page right. Owns the panel snapshot: refetched after
 * every entity event (and on window focus, which picks up upload-path commits
 * confirmed in another tab), with fresh cards flagged for the ~1s accent flash.
 */

interface OnboardingSurfaceProps {
  patientId: string;
  initialSnapshot: OnboardingSnapshot;
  initialMessages: OnboardingMessage[];
  initialPhase: OnboardingPhase;
  completed: boolean;
}

function snapshotIds(snapshot: OnboardingSnapshot): Set<string> {
  return new Set(
    [
      snapshot.conditions,
      snapshot.medications,
      snapshot.doctors,
      snapshot.allergies,
      snapshot.familyHistory,
      snapshot.journal,
    ].flatMap((rows) => rows.map((r) => r.id)),
  );
}

export function OnboardingSurface({
  patientId,
  initialSnapshot,
  initialMessages,
  initialPhase,
  completed,
}: OnboardingSurfaceProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [highlights, setHighlights] = useState<ReadonlySet<string>>(new Set());
  const [live, setLive] = useState(!completed);
  const knownIdsRef = useRef(snapshotIds(initialSnapshot));
  // Ids from entity events since the last refetch — lets UPDATED cards flash
  // and scroll like new ones (a new-id diff alone can't see an in-place edit).
  const pendingEventIdsRef = useRef<Set<string>>(new Set());
  const clearTimerRef = useRef<number | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (clearTimerRef.current !== null) {
        window.clearTimeout(clearTimerRef.current);
      }
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
    },
    [],
  );

  const refreshPanel = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding");
      if (!res.ok) return;
      const body = (await res.json()) as {
        session: { status: string } | null;
        snapshot: OnboardingSnapshot;
      };
      const nextIds = snapshotIds(body.snapshot);
      const fresh = new Set(
        [...nextIds].filter((id) => !knownIdsRef.current.has(id)),
      );
      for (const id of pendingEventIdsRef.current) {
        if (nextIds.has(id)) fresh.add(id);
      }
      pendingEventIdsRef.current.clear();
      knownIdsRef.current = nextIds;
      setSnapshot(body.snapshot);
      setLive(body.session ? body.session.status === "active" : true);
      if (fresh.size > 0) {
        setHighlights(fresh);
        if (clearTimerRef.current !== null) {
          window.clearTimeout(clearTimerRef.current);
        }
        // Slightly past the §6.3 ~1s so the smooth scroll-into-view (panel
        // component) finishes with visible flash time left.
        clearTimerRef.current = window.setTimeout(
          () => setHighlights(new Set()),
          1800,
        );
      }
    } catch {
      // A failed refresh leaves the panel as-is; the next event retries.
    }
  }, []);

  // Trailing debounce: a bulk capture emits many entity events in one turn,
  // and refetching the full snapshot per event would burst dozens of queries
  // against the pooler. One refetch per lull; the highlight diff still works
  // because it diffs against knownIdsRef, not the previous event.
  const requestRefresh = useCallback(
    (entityId?: string) => {
      if (entityId) pendingEventIdsRef.current.add(entityId);
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        void refreshPanel();
      }, 300);
    },
    [refreshPanel],
  );

  // Upload-path commits (§6.3:1258) land in another tab — pick them up when the
  // user returns to this one.
  useEffect(() => {
    const onFocus = () => requestRefresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [requestRefresh]);

  return (
    <div className="flex h-screen">
      <div className="flex w-1/2 flex-col border-r border-border">
        <OnboardingChat
          patientId={patientId}
          initialMessages={initialMessages}
          initialPhase={initialPhase}
          completed={completed}
          onEntity={requestRefresh}
        />
      </div>
      <div className="w-1/2 overflow-hidden">
        <LivePatientPanel
          patientId={patientId}
          snapshot={snapshot}
          highlights={highlights}
          live={live}
        />
      </div>
    </div>
  );
}
