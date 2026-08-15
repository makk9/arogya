import Link from "next/link";
import { notFound } from "next/navigation";

import { AskAiButton } from "@/components/ask-ai-button";
import { Breadcrumb } from "@/components/breadcrumb";
import { Sparkline } from "@/components/dashboard/sparkline";
import { CONTEXT_LABEL, FLAG_LABEL } from "@/components/vitals/vital-options";
import { vitalQueries } from "@/db/queries/vital";
import { getCurrentPatient } from "@/lib/auth";
import { formatAbsoluteDate } from "@/lib/datetime";
import {
  formatVitalValue,
  groupReadingsByType,
  READING_TYPE_LABEL,
} from "@/lib/vitals";

/*
 * Vitals history — grouped by reading type: per-type trend + table, NOT a
 * §6.6 month-grouped card timeline (decisions.md 2026-07-21: "the trend is
 * the value"; 30 near-identical BP cards would be the noisiest page in the
 * app). Reached from the dashboard key-markers card's `history →` and from
 * resolved `vital` entity links, which anchor to a reading's table row
 * (#r-<id>) — this page exists so citations resolve, not for browsing, so
 * there's deliberately no rail item.
 *
 * Readings are immutable (§4:433 — no amendment path; a wrong reading is
 * deleted and re-entered), so rows have no edit affordance here.
 */

const CHART_POINTS = 24;

const TH =
  "px-3 py-2 text-left font-mono text-[0.65rem] font-normal uppercase tracking-wide text-muted-foreground";
const TD = "px-3 py-2 align-baseline";

export default async function VitalsHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const current = await getCurrentPatient();
  if (id !== current.patientId) notFound();

  const readings = await vitalQueries.forPatient(current.patientId);
  const groups = groupReadingsByType(readings, CHART_POINTS);

  return (
    <main className="mx-auto max-w-4xl px-8 py-8">
      <Breadcrumb patientId={current.patientId} trail={[{ label: "vitals" }]} />
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Vitals
        </h1>
        <Link
          href={`/patient/${current.patientId}/vitals/new`}
          className="text-sm text-link underline-offset-4 hover:underline"
        >
          + Log reading
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border px-5 py-8">
          <p className="text-sm font-medium text-foreground">
            No vitals logged yet
          </p>
          <p className="text-sm text-muted-foreground">
            Blood pressure, weight, glucose, and other readings will trend here
            by type once logged.
          </p>
          <Link
            href={`/patient/${current.patientId}/vitals/new`}
            className="mt-1 text-sm text-link underline-offset-4 hover:underline"
          >
            Log a reading →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((g) => {
            const isBp = g.secondaries.length >= 2;
            const min = Math.min(...g.primaries, ...(isBp ? g.secondaries : []));
            const max = Math.max(...g.primaries, ...(isBp ? g.secondaries : []));
            return (
              <section
                key={g.type}
                id={`type-${g.type}`}
                className="scroll-mt-8 rounded-lg border border-border bg-card"
              >
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
                  <div className="flex items-baseline gap-3">
                    <h2 className="text-base font-medium text-foreground">
                      {READING_TYPE_LABEL[g.type]}
                    </h2>
                    <span className="font-mono text-xs text-muted-foreground">
                      {g.rows.length} reading{g.rows.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {g.primaries.length >= 2 ? (
                    <div className="flex items-center gap-3">
                      {isBp ? (
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span aria-hidden className="inline-block h-0.5 w-3 rounded bg-primary" />
                            systolic
                          </span>
                          <span className="flex items-center gap-1">
                            <span aria-hidden className="inline-block h-0.5 w-3 rounded bg-muted-foreground/40" />
                            diastolic
                          </span>
                        </span>
                      ) : null}
                      <Sparkline
                        points={g.primaries}
                        secondary={isBp ? g.secondaries : undefined}
                        width={220}
                        height={48}
                      />
                      <span className="font-mono text-xs text-muted-foreground">
                        {min}–{max} {g.rows[0].unit}
                      </span>
                    </div>
                  ) : null}
                </header>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60">
                      <th className={TH}>Date</th>
                      <th className={TH}>Value</th>
                      <th className={TH}>Context</th>
                      <th className={TH}>Flag</th>
                      <th className={TH}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r) => (
                      <tr
                        key={r.id}
                        id={`r-${r.id}`}
                        className="scroll-mt-24 border-b border-border/40 last:border-b-0 target:bg-accent/40"
                      >
                        <td className={`${TD} whitespace-nowrap text-muted-foreground`}>
                          {formatAbsoluteDate(r.recordedAt)}
                        </td>
                        <td className={`${TD} font-medium text-foreground tabular-nums`}>
                          {formatVitalValue(r)}
                        </td>
                        <td className={`${TD} text-muted-foreground`}>
                          {r.context ? CONTEXT_LABEL[r.context] : "—"}
                        </td>
                        <td className={`${TD} text-muted-foreground`}>
                          {r.flag ? FLAG_LABEL[r.flag] : "—"}
                        </td>
                        <td className={`${TD} max-w-56 truncate text-muted-foreground`}>
                          {r.notes ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          })}
        </div>
      )}
      <AskAiButton surface={{ key: "vitals-history" }} />
    </main>
  );
}
