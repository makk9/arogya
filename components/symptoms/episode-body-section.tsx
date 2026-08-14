"use client";

import Link from "next/link";

import { useMaybeEpisodeEdit } from "@/components/symptoms/episode-edit-context";
import { EpisodeInlineField } from "@/components/symptoms/episode-inline-field";
import type { SymptomEpisode } from "@/db/schema";

/*
 * The §6.7 body section, per-entity header name: EPISODE NOTES. Description is
 * the main free-text body (§6.7:1533); triggers and relief render as labeled
 * sub-blocks (separate Phase 4 fields, easier for the AI to mine — §4:475). A
 * timing sub-block edits ended-at / duration, and a meta sub-block links the
 * episode to the doctor visit it prompted (linked_visit_id forward-link).
 *
 * Sub-blocks omit when empty in read mode (§6.5 omission rationale); a fully
 * empty body reads as a quiet invitation, not a layout gap. Edit mode shows
 * every field.
 */

interface Props {
  patientId: string;
  episode: SymptomEpisode;
  linkedVisitLabel: string | null;
  visitOptions: ReadonlyArray<{ value: string; label: string }>;
}

const SUB_LABEL_CLASS =
  "mb-1 font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground";

export function EpisodeBodySection({
  patientId,
  episode,
  linkedVisitLabel,
  visitOptions,
}: Props) {
  const editCtx = useMaybeEpisodeEdit();
  const editing = editCtx?.editing ?? false;

  const description = episode.description?.trim() ?? "";
  const triggers = episode.triggers?.trim() ?? "";
  const relief = episode.relief?.trim() ?? "";
  const isEmpty =
    !description && !triggers && !relief && episode.endedAt === null &&
    episode.durationMinutes === null && !episode.linkedVisitId;

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Episode notes
      </h2>

      {isEmpty && !editing ? (
        <p className="text-sm text-muted-foreground">
          Nothing recorded about this episode yet — Edit to add what it felt
          like, what brought it on, and what helped.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Each EpisodeInlineField self-manages display vs editor
              (click-to-edit, decisions.md 2026-08-13) — the wrappers keep only
              the omit-when-empty rule. */}
          {description || editing ? (
            <div>
              <h3 className={SUB_LABEL_CLASS}>What it felt like</h3>
              <EpisodeInlineField
                fieldKey="description"
                value={episode.description}
                variant="textarea"
                rows={4}
                required={false}
                clearable
                ariaLabel="Description"
                placeholder="What the episode felt like…"
                displayValue={
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {description}
                  </p>
                }
              />
            </div>
          ) : null}

          {triggers || editing ? (
            <div>
              <h3 className={SUB_LABEL_CLASS}>Triggers</h3>
              <EpisodeInlineField
                fieldKey="triggers"
                value={episode.triggers}
                variant="text"
                required={false}
                clearable
                ariaLabel="Triggers"
                placeholder="After getting up too fast, skipped breakfast…"
                displayValue={
                  <p className="text-sm leading-relaxed">{triggers}</p>
                }
              />
            </div>
          ) : null}

          {relief || editing ? (
            <div>
              <h3 className={SUB_LABEL_CLASS}>What helped</h3>
              <EpisodeInlineField
                fieldKey="relief"
                value={episode.relief}
                variant="text"
                required={false}
                clearable
                ariaLabel="Relief"
                placeholder="Sat down for 5 minutes, took Pudin Hara…"
                displayValue={
                  <p className="text-sm leading-relaxed">{relief}</p>
                }
              />
            </div>
          ) : null}

          {editing ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <h3 className={SUB_LABEL_CLASS}>Ended at</h3>
                <EpisodeInlineField
                  fieldKey="endedAt"
                  value={episode.endedAt ? episode.endedAt.toISOString() : null}
                  variant="datetime"
                  required={false}
                  clearable
                  ariaLabel="Ended at"
                  displayValue={null}
                />
              </div>
              <div>
                <h3 className={SUB_LABEL_CLASS}>Duration (minutes)</h3>
                <EpisodeInlineField
                  fieldKey="durationMinutes"
                  value={
                    episode.durationMinutes !== null
                      ? String(episode.durationMinutes)
                      : null
                  }
                  variant="number"
                  required={false}
                  clearable
                  ariaLabel="Duration in minutes"
                  placeholder="30"
                  displayValue={null}
                />
              </div>
            </div>
          ) : null}

          {editing || (episode.linkedVisitId && linkedVisitLabel) ? (
            <div>
              <h3 className={SUB_LABEL_CLASS}>Prompted a doctor visit</h3>
              <EpisodeInlineField
                fieldKey="linkedVisitId"
                value={episode.linkedVisitId}
                variant="select"
                required={false}
                clearable
                ariaLabel="Prompted visit"
                placeholder="No linked visit…"
                options={visitOptions}
                // Populated → the visit link keeps the click (navigation
                // wins), the ✎ edits.
                displayIsInteractive={Boolean(episode.linkedVisitId)}
                displayValue={
                  episode.linkedVisitId && linkedVisitLabel ? (
                    <Link
                      href={`/patient/${patientId}/visits/${episode.linkedVisitId}`}
                      className="text-sm text-link underline-offset-4 hover:underline"
                    >
                      {linkedVisitLabel} →
                    </Link>
                  ) : null
                }
              />
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
