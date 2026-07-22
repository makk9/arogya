"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { WikiCounts } from "@/db/queries/wiki-counts";
import { cn } from "@/lib/utils";

/*
 * The Health Wiki rail (§3 "Health Wiki rail structure" + §6.1:1146). Three
 * zones: rail header (branding + patient switcher) · top-level surfaces · the
 * nine HEALTH WIKI category items with counts · footer.
 *
 * Phase D scope / deviations (flagged in the handoff):
 *  - Dashboard (§6.1) is not built as a route, so it is omitted as a top-level
 *    item; the patient-switcher header links to the built profile home (§6.10).
 *  - Chat (§6.2 full-screen) shipped in Phase E (E0b); the "Chat" item links to
 *    it. The ephemeral Ask-AI drawer is kept for the floating per-entity-page
 *    button only (ratified split, 2026-06-28 — see decisions.md).
 *  - RECENT group (§3) is omitted — it needs recency tracking not yet modeled.
 *  - The `⌘K · search wiki` footer renders as an inert hint: wiki search is
 *    explicitly v1-excluded (§10.1), so it signals the affordance's home
 *    without implying it works.
 *
 * Counts come from the server (layout), so the rail stays a thin client island
 * owning only active-state + the Chat drawer trigger. All color via tokens.
 */

interface WikiItem {
  label: string;
  segment: string;
  count: number;
}

interface Props {
  patientId: string;
  patientName: string;
  relationship: string;
  counts: WikiCounts;
}

export function WikiRail({ patientId, patientName, relationship, counts }: Props) {
  const pathname = usePathname();
  const base = `/patient/${patientId}`;

  const wikiItems: WikiItem[] = [
    { label: "Medications", segment: "medications", count: counts.medications },
    { label: "Conditions", segment: "conditions", count: counts.conditions },
    { label: "Doctors", segment: "doctors", count: counts.doctors },
    { label: "Family history", segment: "family-history", count: counts.familyHistory },
    { label: "Visits", segment: "visits", count: counts.visits },
    { label: "Labs", segment: "labs", count: counts.labs },
    { label: "Symptoms", segment: "symptoms", count: counts.symptoms },
    { label: "Reports", segment: "reports", count: counts.reports },
    { label: "Journal", segment: "journal", count: counts.journal },
  ];

  // A segment is active when the path is that section or anything under it.
  const isActive = (segment: string) =>
    pathname === `${base}/${segment}` || pathname.startsWith(`${base}/${segment}/`);

  const profileActive = pathname === base;
  const insightsActive = isActive("insights");
  const chatActive = isActive("chat");

  return (
    <nav
      aria-label="Health wiki"
      className="sticky top-0 flex h-screen w-60 shrink-0 flex-col gap-5 overflow-y-auto border-r border-border bg-card px-3 py-5"
    >
      {/* Rail header — branding + patient switcher */}
      <div className="px-2">
        <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          arogya <span className="text-foreground/60">v0.1</span>
        </span>
        <Link
          href={base}
          className={cn(
            "mt-2 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60",
            profileActive && "bg-muted",
          )}
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{patientName}</span>
            <span className="block text-xs text-muted-foreground">{relationship}</span>
          </span>
          <span aria-hidden className="shrink-0 text-xs text-muted-foreground">
            ▾
          </span>
        </Link>
      </div>

      {/* Top-level surfaces — Chat first, Insights below (§6.1's dashboard
          hierarchy: chat is the centerpiece, insights feed sits under it). */}
      <div className="flex flex-col gap-0.5">
        <Link
          href={`${base}/chat`}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted/60",
            chatActive ? "bg-muted font-medium" : "text-foreground/80",
          )}
        >
          Chat
        </Link>
        <Link
          href={`${base}/insights`}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted/60",
            insightsActive ? "bg-muted font-medium" : "text-foreground/80",
          )}
        >
          Insights
        </Link>
      </div>

      {/* HEALTH WIKI */}
      <div className="flex flex-col gap-0.5">
        <span className="px-3 pb-1 font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">
          Health wiki
        </span>
        {wikiItems.map((item) => {
          const active = isActive(item.segment);
          return (
            <Link
              key={item.segment}
              href={`${base}/${item.segment}`}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted/60",
                active ? "bg-muted font-medium" : "text-foreground/80",
              )}
            >
              <span>{item.label}</span>
              {item.count > 0 ? (
                <span className="shrink-0 font-mono text-[0.7rem] text-muted-foreground">
                  {item.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      {/* Footer — search affordance (v1-excluded; inert) */}
      <div className="mt-auto px-3">
        <span className="block font-mono text-[0.7rem] text-muted-foreground/70">
          ⌘K · search wiki
        </span>
      </div>
    </nav>
  );
}
