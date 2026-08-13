"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { WikiCounts } from "@/db/queries/wiki-counts";
import { cn } from "@/lib/utils";

/*
 * The Health Wiki rail (§3 "Health Wiki rail structure" + §6.1:1146). Three
 * zones: rail header (branding + patient switcher) · top-level surfaces · the
 * HEALTH WIKI category items with counts (twelve since 2026-08-12, in
 * PROFILE/TIMELINE groups rendering §3's own State/Event type column) · footer.
 *
 * Scope / deviations (flagged in the handoff):
 *  - Dashboard (§6.1) shipped in Phase E (E0a) — the top top-level item; the
 *    patient-switcher header keeps linking to the profile home (§6.10).
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
  // Absent for countless singletons (Lifestyle) — no badge renders.
  count?: number;
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

  // Two groups mirroring §4's state/event split. §3 spec'd nine items;
  // Allergies, Lifestyle, and Vitals were promoted 2026-08-12 (user sign-off,
  // decisions.md): every surface with a page gets a rail item — the profile
  // page is a summary hub, not a secret second navigation system.
  const stateItems: WikiItem[] = [
    { label: "Medications", segment: "medications", count: counts.medications },
    { label: "Conditions", segment: "conditions", count: counts.conditions },
    { label: "Allergies", segment: "allergies", count: counts.allergies },
    { label: "Doctors", segment: "doctors", count: counts.doctors },
    { label: "Family history", segment: "family-history", count: counts.familyHistory },
    { label: "Lifestyle", segment: "lifestyle" },
  ];
  const eventItems: WikiItem[] = [
    { label: "Visits", segment: "visits", count: counts.visits },
    { label: "Labs", segment: "labs", count: counts.labs },
    { label: "Vitals", segment: "vitals", count: counts.vitals },
    { label: "Symptoms", segment: "symptoms", count: counts.symptoms },
    { label: "Reports", segment: "reports", count: counts.reports },
    { label: "Journal", segment: "journal", count: counts.journal },
  ];

  // A segment is active when the path is that section or anything under it.
  const isActive = (segment: string) =>
    pathname === `${base}/${segment}` || pathname.startsWith(`${base}/${segment}/`);

  const renderItem = (item: WikiItem) => {
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
        {item.count !== undefined && item.count > 0 ? (
          <span className="shrink-0 font-mono text-[0.7rem] text-muted-foreground">
            {item.count}
          </span>
        ) : null}
      </Link>
    );
  };

  const profileActive = pathname === base;
  const dashboardActive = isActive("dashboard");
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

      {/* Top-level surfaces — Dashboard on top (§3: "the wiki entry point"),
          then Chat above Insights (§6.1's hierarchy: chat is the primary
          affordance, the insights feed sits under it). */}
      <div className="flex flex-col gap-0.5">
        <Link
          href={`${base}/dashboard`}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted/60",
            dashboardActive ? "bg-muted font-medium" : "text-foreground/80",
          )}
        >
          Dashboard
        </Link>
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
            "flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted/60",
            insightsActive ? "bg-muted font-medium" : "text-foreground/80",
          )}
        >
          <span>Insights</span>
          {/* Unread badge — insights still `new` (§4:583). Accent tint per the
              pill convention; clears via the feed's new→seen transition. */}
          {counts.insightsNew > 0 ? (
            <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 font-mono text-[0.65rem] leading-none text-accent-foreground ring-1 ring-accent-foreground/15">
              {counts.insightsNew} new
            </span>
          ) : null}
        </Link>
      </div>

      {/* HEALTH WIKI */}
      <div className="flex flex-col gap-0.5">
        <span className="px-3 pb-1 font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">
          Health wiki
        </span>
        {/* Labeled sub-groups (user calls 2026-08-12 ×2: a bare divider read
            as "what is this dividing?", and CURRENT/HISTORY misread as a time
            split): PROFILE = state entities, the enduring description;
            TIMELINE = event entities, dated happenings (§4). "The visit goes
            on the timeline; the prescription it produced joins his profile."
            role="group" + aria-label so screen readers get the structure; the
            visible labels are decorative duplicates, hence aria-hidden. */}
        <div role="group" aria-label="Profile" className="flex flex-col gap-0.5">
          <span
            aria-hidden
            className="px-3 pb-0.5 pt-1 font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground/70"
          >
            Profile
          </span>
          {stateItems.map((item) => renderItem(item))}
        </div>
        <div role="group" aria-label="Timeline" className="mt-2 flex flex-col gap-0.5">
          <span
            aria-hidden
            className="px-3 pb-0.5 font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground/70"
          >
            Timeline
          </span>
          {eventItems.map((item) => renderItem(item))}
        </div>
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
