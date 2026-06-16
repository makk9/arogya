"use client";

import { LabInlineField } from "@/components/labs/lab-inline-field";
import { useMaybeLabEdit } from "@/components/labs/lab-edit-context";

interface Props {
  notes: string;
}

/*
 * §6.7 Notes section — the caregiver's own free-form context, distinct from the
 * report's `summary` (the doctor's/AI interpretation). Omitted when empty
 * outside edit mode; always rendered in edit mode so notes can be added. Clones
 * visit-notes-section.tsx.
 */
export function LabNotesSection({ notes }: Props) {
  const editCtx = useMaybeLabEdit();
  const editing = editCtx?.editing ?? false;

  if (!notes && !editing) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Notes
      </h2>
      {editing ? (
        <LabInlineField
          fieldKey="notes"
          value={notes}
          variant="textarea"
          required={false}
          clearable
          ariaLabel="Notes"
          placeholder="Your own context — what prompted the panel, anything the lab flagged by phone."
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
