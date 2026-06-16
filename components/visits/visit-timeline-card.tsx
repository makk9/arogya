import Link from "next/link";

import { STATUS_LABEL, VISIT_TYPE_LABEL } from "@/components/visits/visit-options";
import type { OutcomeItem } from "@/components/visits/visit-outcome-model";
import type { Doctor, Visit } from "@/db/schema";
import { cn } from "@/lib/utils";
import { displayDoctorName } from "@/lib/doctor-display";

/*
 * Visit timeline card per design.md §6.6 — date-anchored layout: date column
 * left (`APR / 30 / Thu`), dotted vertical separator, content right. Whole
 * card navigates to the visit detail; result badges are rendered as plain
 * styled spans inside it (the §6.6 "clickable badges" behavior would nest
 * anchors — the detail page's Outcomes rows carry the link-outs instead;
 * deviation noted in decisions.md).
 *
 * `mostRecent` applies the §6.6 most-recent tint. The palette has no terra
 * token yet (7.2 delegates; periwinkle is the only accent), so the tint rides
 * `--accent` — swap point if a warm token lands.
 *
 * Non-completed visits carry a status pill (SCHEDULED / CANCELLED / NO-SHOW);
 * completed is the unmarked default — §6.6's card sketch assumes completed
 * visits, but scheduled ones share this timeline (§4:357).
 */

interface VisitTimelineCardProps {
  patientId: string;
  visit: Visit;
  doctor: Doctor | undefined;
  outcomes: OutcomeItem[];
  mostRecent: boolean;
}

const WEEKDAY_FMT = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short" });

function dateParts(isoDate: string): { month: string; day: string; weekday: string } {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return {
    month: MONTH_FMT.format(date).toUpperCase(),
    day: String(d),
    weekday: WEEKDAY_FMT.format(date),
  };
}

export function VisitTimelineCard({
  patientId,
  visit,
  doctor,
  outcomes,
  mostRecent,
}: VisitTimelineCardProps) {
  const { month, day, weekday } = dateParts(visit.visitDate);
  const typeLabel = visit.visitType ? VISIT_TYPE_LABEL[visit.visitType] : null;

  return (
    <Link
      href={`/patient/${patientId}/visits/${visit.id}`}
      className={cn(
        "flex gap-4 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-foreground/30 hover:bg-muted/40",
        mostRecent && "border-accent-foreground/25 bg-accent/40 hover:bg-accent/60",
      )}
    >
      <div className="flex w-10 shrink-0 flex-col items-center pt-0.5 text-center">
        <span className="font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">
          {month}
        </span>
        <span className="font-heading text-lg font-semibold leading-tight">
          {day}
        </span>
        <span className="font-mono text-[0.65rem] text-muted-foreground">
          {weekday}
        </span>
      </div>

      <div
        aria-hidden
        className="w-0 self-stretch border-l border-dotted border-border"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-medium">
            {doctor ? (
              <>
                {displayDoctorName(doctor.name)}
                <span className="text-muted-foreground">
                  {" "}
                  · {doctor.specialty}
                </span>
              </>
            ) : (
              "Visit"
            )}
          </span>
          <span className="flex shrink-0 items-baseline gap-2">
            {visit.status !== "completed" ? (
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                {STATUS_LABEL[visit.status] ?? visit.status}
              </span>
            ) : null}
            {doctor?.clinic ? (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {doctor.clinic}
              </span>
            ) : null}
          </span>
        </div>

        {typeLabel || visit.chiefComplaint ? (
          <div className="mt-0.5 text-xs text-muted-foreground">
            {[typeLabel, visit.chiefComplaint].filter(Boolean).join(" · ")}
          </div>
        ) : null}

        {visit.summary ? (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {visit.summary}
          </p>
        ) : null}

        {outcomes.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {outcomes.map((o) => (
              <span
                key={o.key}
                className={cn(
                  "inline-flex items-baseline gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.7rem]",
                  o.significant
                    ? "border-accent-foreground/25 bg-accent text-accent-foreground"
                    : "border-border bg-muted text-muted-foreground",
                )}
              >
                <span aria-hidden>{o.glyph}</span>
                {o.text}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
