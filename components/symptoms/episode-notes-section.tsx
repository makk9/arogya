"use client";

import { useMaybeEpisodeEdit } from "@/components/symptoms/episode-edit-context";
import { EpisodeInlineField } from "@/components/symptoms/episode-inline-field";

interface Props {
  notes: string;
}

/*
 * Notes per §6.7 section 4 — the caregiver's own free-form note, distinct from
 * the episode's description (what it felt like). Omitted when empty outside edit
 * mode; always rendered in edit mode so notes can be added. Clones
 * visit-notes-section.
 */
export function EpisodeNotesSection({ notes }: Props) {
  const editCtx = useMaybeEpisodeEdit();
  const editing = editCtx?.editing ?? false;

  if (!notes && !editing) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Notes
      </h2>
      {editing ? (
        <EpisodeInlineField
          fieldKey="notes"
          value={notes}
          variant="textarea"
          required={false}
          clearable
          ariaLabel="Notes"
          placeholder="Anything else worth remembering about this episode."
          displayValue={
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {notes}
            </p>
          }
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{notes}</p>
      )}
    </section>
  );
}
