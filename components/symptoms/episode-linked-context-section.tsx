import Link from "next/link";

import { SEVERITY_LABEL } from "@/components/symptoms/symptom-options";
import type { SymptomEpisode } from "@/db/schema";
import { formatAbsoluteDate } from "@/lib/datetime";

/*
 * The §6.7 Linked context for a symptom episode — "related episodes nearby in
 * time" (same-type siblings, §6.7:1533), with the §6.7 relative-to-page framing
 * ("13 days before"). The parent SymptomType link is NOT repeated here — it's
 * the header's explicit parent-link chip (§6.7:1509); duplicating it made a
 * single-episode page read as "Dizziness → Dizziness" (linking to itself). With
 * no siblings there is no context to show, so the whole section omits.
 */

interface Props {
  patientId: string;
  typeName: string;
  thisEpisodeAt: Date;
  siblings: SymptomEpisode[];
}

function relativeToEpisode(siblingAt: Date, anchorAt: Date): string {
  const day = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((day(siblingAt) - day(anchorAt)) / 86_400_000);
  if (dayDiff === 0) return "same day";
  if (dayDiff > 0) return `${dayDiff} ${dayDiff === 1 ? "day" : "days"} after`;
  const before = -dayDiff;
  return `${before} ${before === 1 ? "day" : "days"} before`;
}

export function EpisodeLinkedContextSection({
  patientId,
  typeName,
  thisEpisodeAt,
  siblings,
}: Props) {
  if (siblings.length === 0) return null;

  const SIBLING_LIMIT = 5;
  const shown = siblings.slice(0, SIBLING_LIMIT);

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Linked context
      </h2>

      <p className="mb-1.5 text-xs text-muted-foreground">
        Other {typeName.toLowerCase()} episodes · {siblings.length}
      </p>
      <div className="flex flex-col gap-1.5">
        {shown.map((e) => (
          <Link
            key={e.id}
            href={`/patient/${patientId}/symptoms/${e.id}`}
            className="flex items-baseline justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm transition-colors hover:border-foreground/30 hover:bg-muted/40"
          >
            <span className="min-w-0">
              {formatAbsoluteDate(e.startedAt)}
              {e.severity ? (
                <span className="text-muted-foreground">
                  {" "}
                  · {SEVERITY_LABEL[e.severity] ?? e.severity}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {relativeToEpisode(e.startedAt, thisEpisodeAt)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
