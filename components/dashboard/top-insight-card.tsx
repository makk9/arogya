import Link from "next/link";

import { DashboardCard, DashboardCardEmpty } from "@/components/dashboard/dashboard-card";
import { previewText } from "@/components/insights/insight-card";
import { CATEGORY_LABEL, SEVERITY_DOT } from "@/components/insights/insight-options";
import type { Insight } from "@/db/schema";
import { formatRelative } from "@/lib/datetime";

/*
 * §6.1:1153 TOP INSIGHT card — the most recent open insight, tinted (the
 * accent treatment is reserved for a real insight; the empty state stays
 * neutral per the §6.1 pending-polish note "untint the empty Insights card").
 * Whole card navigates to the insight detail; "view all N →" to the feed.
 */

export function TopInsightCard({
  patientId,
  insight,
  totalCount,
}: {
  patientId: string;
  insight: Insight | null;
  totalCount: number;
}) {
  const base = `/patient/${patientId}`;

  if (!insight) {
    return (
      <DashboardCard title="Top insight">
        <DashboardCardEmpty
          headline="No insights yet"
          explanation="As the record grows, patterns worth knowing about will surface here."
          cta={{ label: "Open the insights feed", href: `${base}/insights` }}
        />
      </DashboardCard>
    );
  }

  const dot = SEVERITY_DOT[insight.severity];
  const categoryLabel = CATEGORY_LABEL[insight.category] ?? insight.category;

  return (
    <section className="rounded-lg border border-accent-foreground/20 bg-accent/50">
      <header className="flex items-baseline justify-between gap-3 border-b border-accent-foreground/15 px-4 py-2.5">
        <h2 className="font-mono text-xs uppercase tracking-wide text-accent-foreground/80">
          Top insight
        </h2>
        <Link
          href={`${base}/insights`}
          className="shrink-0 text-xs text-link underline-offset-4 hover:underline"
        >
          view all {totalCount} →
        </Link>
      </header>
      <Link
        href={`${base}/insights/${insight.id}`}
        className="flex gap-3 px-4 py-3 transition-colors hover:bg-accent/70"
      >
        <div className="flex w-2 shrink-0 justify-center pt-1.5">
          {dot ? (
            <span
              aria-label={`${dot.label} severity`}
              className={`h-2 w-2 rounded-full ${dot.tokenClass}`}
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{insight.title}</p>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
            {previewText(insight.body)}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {categoryLabel} · {formatRelative(insight.generatedAt)}
          </p>
        </div>
      </Link>
    </section>
  );
}
