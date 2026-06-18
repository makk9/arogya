import Link from "next/link";

import { LinkedVitalPill } from "@/components/symptoms/linked-vital-pill";
import { SEVERITY_LABEL, severityIsWarm } from "@/components/symptoms/symptom-options";
import type { SymptomEpisode, VitalReading } from "@/db/schema";
import { cn } from "@/lib/utils";

/*
 * Symptom episode timeline card per §6.6 — date+time column (`APR / 28 /
 * 7:15am`), dotted vertical separator, content right. Whole card navigates to
 * the episode detail. Severity pill top-right (MODERATE/SEVERE warm, MILD
 * neutral); one-line description; optional `●` linked-vital pills below.
 *
 * `mostRecent` applies the §6.6 most-recent tint (Visits + Symptoms only). The
 * §6.6 "inline temporal correlation tag" ("Day after dose change") is
 * deliberately NOT rendered: that cross-entity correlation is the synthesis
 * agent's job to reason about and cite (Phase 5), not a date-window heuristic in
 * the page — same call as the Visit linked-context (decisions.md). Flagged.
 */

interface Props {
  patientId: string;
  episode: SymptomEpisode;
  linkedVitals: VitalReading[];
  mostRecent: boolean;
}

const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short" });
const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

function timeLabel(d: Date): string {
  return TIME_FMT.format(d).replace(" ", "").toLowerCase();
}

function durationLabel(episode: SymptomEpisode): string | null {
  if (episode.durationMinutes !== null) {
    const m = episode.durationMinutes;
    if (m < 60) return `${m} min`;
    const hours = Math.floor(m / 60);
    const mins = m % 60;
    return mins === 0 ? `${hours} hr` : `${hours} hr ${mins} min`;
  }
  return null;
}

export function SymptomEpisodeCard({
  patientId,
  episode,
  linkedVitals,
  mostRecent,
}: Props) {
  const started = episode.startedAt;
  const month = MONTH_FMT.format(started).toUpperCase();
  const day = String(started.getDate());
  const time = timeLabel(started);
  const duration = durationLabel(episode);
  const warm = severityIsWarm(episode.severity);

  return (
    <Link
      href={`/patient/${patientId}/symptoms/${episode.id}`}
      className={cn(
        "flex gap-4 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-foreground/30 hover:bg-muted/40",
        mostRecent && "border-accent-foreground/25 bg-accent/40 hover:bg-accent/60",
      )}
    >
      <div className="flex w-12 shrink-0 flex-col items-center pt-0.5 text-center">
        <span className="font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">
          {month}
        </span>
        <span className="font-heading text-lg font-semibold leading-tight">
          {day}
        </span>
        <span className="font-mono text-[0.6rem] text-muted-foreground">
          {time}
        </span>
      </div>

      <div
        aria-hidden
        className="w-0 self-stretch border-l border-dotted border-border"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-medium">
            {duration ?? <span className="text-muted-foreground">Episode</span>}
          </span>
          {episode.severity ? (
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide",
                warm
                  ? "border border-accent-foreground/25 bg-accent text-accent-foreground"
                  : "border border-border bg-muted text-muted-foreground",
              )}
            >
              {SEVERITY_LABEL[episode.severity] ?? episode.severity}
            </span>
          ) : null}
        </div>

        {episode.description ? (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {episode.description}
          </p>
        ) : null}

        {linkedVitals.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {linkedVitals.map((v) => (
              <LinkedVitalPill key={v.id} reading={v} />
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
