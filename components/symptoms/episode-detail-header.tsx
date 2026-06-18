"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useMaybeEpisodeEdit } from "@/components/symptoms/episode-edit-context";
import { EpisodeInlineField } from "@/components/symptoms/episode-inline-field";
import {
  SEVERITY_LABEL,
  SEVERITY_OPTIONS,
  severityIsWarm,
} from "@/components/symptoms/symptom-options";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SymptomEpisode } from "@/db/schema";
import { formatAbsoluteDate } from "@/lib/datetime";

interface Props {
  patientId: string;
  episode: SymptomEpisode;
  typeId: string;
  typeName: string;
  actionsSlot: ReactNode | null;
}

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

/*
 * SymptomEpisode detail header per §6.7 page shell. Title is the §6.7
 * episode shape — `Dizziness · Apr 28 2026` — with the severity pill beside it.
 * A dedicated parent-link chip to the SymptomType sits under the title (§6.7:1509
 * "explicit parent-link to its SymptomType in addition to the breadcrumb").
 * Subtitle is the merged capture context: start time · duration.
 *
 * Edit mode swaps the title's date (started_at) and the severity into inline
 * fields — the event row is correctable in place.
 */
export function EpisodeDetailHeader({
  patientId,
  episode,
  typeId,
  typeName,
  actionsSlot,
}: Props) {
  const editCtx = useMaybeEpisodeEdit();
  const editing = editCtx?.editing ?? false;
  const setEditing = editCtx?.setEditing ?? (() => {});

  const time = timeLabel(episode.startedAt);
  const duration = durationLabel(episode);

  const subtitleParts: string[] = [time];
  if (duration) subtitleParts.push(`lasted ${duration}`);

  const severityItems = SEVERITY_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
  }));

  return (
    <>
      <nav
        aria-label="breadcrumb"
        className="mb-6 font-mono text-xs text-muted-foreground"
      >
        / patient / {patientId.slice(0, 8)}… / symptoms /{" "}
        {episode.startedAt.toISOString().slice(0, 10)}
      </nav>

      <div className="mb-2 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <EpisodeInlineField
                fieldKey="startedAt"
                value={episode.startedAt.toISOString()}
                variant="datetime"
                required
                clearable={false}
                ariaLabel="Started at"
                displayValue={null}
              />
              <EpisodeInlineField
                fieldKey="severity"
                value={episode.severity}
                variant="select"
                required={false}
                clearable
                ariaLabel="Severity"
                placeholder="Severity…"
                options={severityItems}
                displayValue={null}
              />
            </div>
          ) : (
            <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-heading text-2xl font-semibold leading-tight">
              <span className="border-b-2 border-destructive pb-1">
                {typeName} · {formatAbsoluteDate(episode.startedAt)}
              </span>
              {/* Names what this page is — one occurrence — so it doesn't read
                  as a second copy of the symptom's own page. */}
              <span className="inline-flex items-baseline rounded-full border border-border bg-muted px-2 py-0.5 text-[0.55em] font-medium uppercase tracking-wide text-muted-foreground">
                Episode
              </span>
              {episode.severity ? (
                <span
                  className={cn(
                    "inline-flex items-baseline rounded-full px-2 py-0.5 text-[0.55em] font-medium uppercase tracking-wide",
                    severityIsWarm(episode.severity)
                      ? "border border-accent-foreground/25 bg-accent text-accent-foreground"
                      : "border border-border bg-muted text-muted-foreground",
                  )}
                >
                  {SEVERITY_LABEL[episode.severity] ?? episode.severity}
                </span>
              ) : null}
            </h1>
          )}

          {!editing ? (
            // The EPISODE tag + this ↑ link already establish "one occurrence,
            // go up to the symptom"; the title names the symptom — so the link
            // stays terse (matches the timeline's "View symptom →").
            <Link
              href={`/patient/${patientId}/symptoms/types/${typeId}`}
              className="mt-2 inline-flex items-baseline gap-1.5 text-xs text-link underline-offset-4 hover:underline"
            >
              <span aria-hidden>↑</span>
              View symptom →
            </Link>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant={editing ? "default" : "outline"}
            size="sm"
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Done" : "Edit"}
          </Button>
          {actionsSlot}
        </div>
      </div>

      {!editing ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {subtitleParts.join(" · ")}
        </p>
      ) : null}
    </>
  );
}
