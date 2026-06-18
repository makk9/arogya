import Link from "next/link";

import type { ReportOutcomes } from "@/db/queries/report";

/*
 * The §6.7 Outcomes section — "extracted entities (medications, conditions
 * surfaced from the report)". Replaces the state template's History (events have
 * no change log). Each derived entity carries source_report_id back to this
 * report; rows link out to the entity's detail page.
 *
 * Populated by the Phase E extraction pipeline (source_report_id is written
 * during upload → confirmation). For manually-entered reports it's empty, and
 * the parent omits the section entirely (§6.5:1386 omission rationale) — there's
 * no call to action here, since the link is created from the entity side.
 */

interface Props {
  patientId: string;
  outcomes: ReportOutcomes;
}

export function ReportOutcomesSection({ patientId, outcomes }: Props) {
  const { medications, conditions } = outcomes;
  if (medications.length === 0 && conditions.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Outcomes
      </h2>
      <div className="flex flex-col gap-2">
        {medications.map((m) => (
          <div
            key={m.id}
            className="flex items-baseline justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
          >
            <span className="text-sm font-medium">
              <span aria-hidden className="mr-1.5 font-mono">
                +
              </span>
              {m.name}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                medication
              </span>
            </span>
            <Link
              href={`/patient/${patientId}/medications/${m.id}`}
              className="shrink-0 text-xs text-link underline-offset-4 hover:underline"
            >
              View medication →
            </Link>
          </div>
        ))}
        {conditions.map((c) => (
          <div
            key={c.id}
            className="flex items-baseline justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
          >
            <span className="text-sm font-medium">
              <span aria-hidden className="mr-1.5 font-mono">
                +
              </span>
              {c.name}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                condition
              </span>
            </span>
            <Link
              href={`/patient/${patientId}/conditions/${c.id}`}
              className="shrink-0 text-xs text-link underline-offset-4 hover:underline"
            >
              View condition →
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
