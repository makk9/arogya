import Link from "next/link";

import type { Condition, LabReport } from "@/db/schema";
import { formatAbsoluteDate } from "@/lib/datetime";

/*
 * §6.7 Linked context for a lab report. Two strands:
 *  - Monitored conditions — conditions referenced by this report's markers
 *    (lab_results.linked_condition). Backlinks into the state vault.
 *  - Previous panels of the same type — the §6.7 "Previous lipid panels · N"
 *    temporal back-link, with relative-to-page framing ("2 months earlier").
 *
 * Forward-links (later panels of the same type) are deliberately not surfaced
 * here — a lab report's longitudinal neighbors of interest are the *prior*
 * results for trend reading; the synthesis agent (Phase 5) handles "creatinine
 * over 12 months" reasoning. Parent omits the section when both strands empty.
 */

interface Props {
  patientId: string;
  reportDate: string;
  monitoredConditions: ReadonlyArray<Condition>;
  previousPanels: ReadonlyArray<LabReport>;
}

function monthsBefore(reportDate: string, earlier: string): string {
  const [ry, rm, rd] = reportDate.split("-").map(Number);
  const [ey, em, ed] = earlier.split("-").map(Number);
  const ref = new Date(ry, rm - 1, rd);
  const then = new Date(ey, em - 1, ed);
  const dayDiff = Math.round((ref.getTime() - then.getTime()) / 86_400_000);
  if (dayDiff <= 0) return "same day";
  if (dayDiff < 30) return `${dayDiff} ${dayDiff === 1 ? "day" : "days"} earlier`;
  const months = Math.floor(dayDiff / 30);
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"} earlier`;
  const years = Math.floor(dayDiff / 365);
  return `${years} ${years === 1 ? "year" : "years"} earlier`;
}

export function LabLinkedContextSection({
  patientId,
  reportDate,
  monitoredConditions,
  previousPanels,
}: Props) {
  if (monitoredConditions.length === 0 && previousPanels.length === 0) {
    return null;
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Linked context
      </h2>

      <div className="flex flex-col gap-4">
        {monitoredConditions.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">
              Conditions these markers monitor · {monitoredConditions.length}
            </p>
            {monitoredConditions.map((c) => (
              <Link
                key={c.id}
                href={`/patient/${patientId}/conditions/${c.id}`}
                className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm transition-colors hover:border-foreground/30 hover:bg-muted/40"
              >
                <span className="font-medium">{c.name}</span>
              </Link>
            ))}
          </div>
        ) : null}

        {previousPanels.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">
              Previous panels of this type · {previousPanels.length}
            </p>
            {previousPanels.map((p) => (
              <Link
                key={p.id}
                href={`/patient/${patientId}/labs/${p.id}`}
                className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm transition-colors hover:border-foreground/30 hover:bg-muted/40"
              >
                <span className="font-medium">
                  {p.reportType ?? p.labName ?? "Lab report"}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · {formatAbsoluteDate(p.reportDate)} ·{" "}
                  {monthsBefore(reportDate, p.reportDate)}
                </span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
