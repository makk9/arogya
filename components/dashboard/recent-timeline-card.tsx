import Link from "next/link";

import { DashboardCard, DashboardCardEmpty } from "@/components/dashboard/dashboard-card";
import type { RecentActivityItem } from "@/db/queries/dashboard";
import { formatRelativeDate } from "@/lib/datetime";

/*
 * §6.1:1153 RECENT TIMELINE card — the newest events across all six event
 * entities, merged newest-first (db/queries/dashboard.ts). Each row: relative
 * date · type tag · label linking to the event's own page (vitals anchor into
 * the grouped history view — they have no detail page by design).
 */

const TYPE_TAG: Record<RecentActivityItem["type"], string> = {
  visit: "visit",
  lab: "lab",
  symptom: "symptom",
  report: "report",
  journal: "journal",
  vital: "vital",
};

export function RecentTimelineCard({
  patientId,
  items,
}: {
  patientId: string;
  items: RecentActivityItem[];
}) {
  const base = `/patient/${patientId}`;

  return (
    <DashboardCard
      title="Recent timeline"
      action={items.length > 0 ? { label: "visits →", href: `${base}/visits` } : undefined}
    >
      {items.length === 0 ? (
        <DashboardCardEmpty
          headline="Nothing logged yet"
          explanation="Visits, labs, symptoms, and notes will collect here as they're recorded."
          cta={{ label: "Log a visit", href: `${base}/visits/new` }}
        />
      ) : (
        <ul>
          {items.map((item) => (
            <li
              key={`${item.type}:${item.id}`}
              className="flex items-baseline gap-3 border-b border-border/60 px-4 py-2 last:border-b-0"
            >
              <span className="w-16 shrink-0 text-xs text-muted-foreground">
                {formatRelativeDate(item.date)}
              </span>
              <span className="w-14 shrink-0 font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                {TYPE_TAG[item.type]}
              </span>
              <Link
                href={item.href}
                className="min-w-0 truncate text-sm text-foreground underline-offset-4 hover:underline"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
