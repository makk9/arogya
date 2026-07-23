import { DashboardCard, DashboardCardEmpty } from "@/components/dashboard/dashboard-card";
import { Sparkline, trendArrow } from "@/components/dashboard/sparkline";
import type { VitalReading } from "@/db/schema";
import { formatRelativeDate } from "@/lib/datetime";
import {
  formatVitalValue,
  groupReadingsByType,
  READING_TYPE_LABEL,
} from "@/lib/vitals";

/*
 * §6.1:1153 KEY MARKERS card — vitals' primary home (decisions.md 2026-07-21:
 * vitals deliberately have no page/rail item; "the trend is the value"). One
 * stat tile per reading type with data: label · latest value · neutral trend
 * arrow · 12-point sparkline (BP carries diastolic as the lighter second
 * line). `history →` goes to the grouped per-type history view.
 *
 * Tile contract per the dataviz stat-tile spec: sentence-case label, sans
 * value in text ink (never the series color), sparkline in the de-emphasis
 * hue with the current period in the accent.
 */

const SPARK_POINTS = 12;

export function KeyMarkersCard({
  patientId,
  readings,
}: {
  patientId: string;
  readings: VitalReading[];
}) {
  const base = `/patient/${patientId}`;
  const groups = groupReadingsByType(readings, SPARK_POINTS);

  return (
    <DashboardCard
      title="Key markers"
      action={
        groups.length > 0 ? { label: "history →", href: `${base}/vitals` } : undefined
      }
    >
      {groups.length === 0 ? (
        <DashboardCardEmpty
          headline="No vitals logged yet"
          explanation="Blood pressure, weight, and other readings will trend here once logged."
          cta={{ label: "Log a reading", href: `${base}/vitals/new` }}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => {
            const latest = g.rows[0];
            const arrow = trendArrow(g.primaries);
            return (
              <li key={g.type} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <span className="block text-xs text-muted-foreground">
                    {READING_TYPE_LABEL[g.type]}
                  </span>
                  <span className="block text-base font-semibold text-foreground">
                    {formatVitalValue(latest)}
                    {arrow ? (
                      <span
                        aria-label={
                          arrow === "↑" ? "up from previous" : arrow === "↓" ? "down from previous" : "unchanged"
                        }
                        className="ml-1.5 text-sm font-normal text-muted-foreground"
                      >
                        {arrow}
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {formatRelativeDate(latest.recordedAt)}
                  </span>
                </div>
                <Sparkline
                  points={g.primaries}
                  secondary={g.secondaries.length >= 2 ? g.secondaries : undefined}
                  className="shrink-0"
                />
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}
