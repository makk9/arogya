import Link from "next/link";

import type { VisitLinkedEpisode } from "@/db/queries/visit";
import { formatAbsoluteDate } from "@/lib/datetime";

/*
 * The §6.7 Linked context section — temporal forward-links: events that came
 * after (or alongside) this visit. v1 surfaces the FK-linked symptom episodes
 * (symptom_episodes.linked_visit_id) with the §6.7 relative-to-page framing
 * ("Apr 6 · 3 days after visit"). Each row links to its episode detail page.
 *
 * Pure-temporal neighbors (episodes near the visit date without an FK) are
 * deliberately NOT queried — that inference belongs to the synthesis agent
 * (Phase 5), not a date-window heuristic in the page. Parent omits the section
 * when empty.
 */

interface Props {
  patientId: string;
  visitDate: string;
  episodes: VisitLinkedEpisode[];
}

function relativeToVisit(episodeAt: Date, visitDate: string): string {
  const [y, m, d] = visitDate.split("-").map(Number);
  const visit = new Date(y, m - 1, d);
  const episodeDay = new Date(
    episodeAt.getFullYear(),
    episodeAt.getMonth(),
    episodeAt.getDate(),
  );
  const dayDiff = Math.round(
    (episodeDay.getTime() - visit.getTime()) / 86_400_000,
  );
  if (dayDiff === 0) return "same day as visit";
  if (dayDiff > 0) {
    return `${dayDiff} ${dayDiff === 1 ? "day" : "days"} after visit`;
  }
  const before = -dayDiff;
  return `${before} ${before === 1 ? "day" : "days"} before visit`;
}

export function VisitLinkedContextSection({
  patientId,
  visitDate,
  episodes,
}: Props) {
  if (episodes.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Linked context
      </h2>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-muted-foreground">
          Symptom episodes linked to this visit · {episodes.length}
        </p>
        {episodes.map(({ episode, symptomTypeName }) => (
          <Link
            key={episode.id}
            href={`/patient/${patientId}/symptoms/${episode.id}`}
            className="block rounded-lg border border-border bg-card px-4 py-2.5 text-sm transition-colors hover:border-foreground/30 hover:bg-muted/40"
          >
            <span className="font-medium">{symptomTypeName}</span>
            <span className="text-muted-foreground">
              {" "}
              · {formatAbsoluteDate(episode.startedAt)} ·{" "}
              {relativeToVisit(episode.startedAt, visitDate)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
