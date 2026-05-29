"use client";

import { InlineField } from "@/components/medications/inline-field";
import { useMaybeMedicationEdit } from "@/components/medications/medication-edit-context";

interface Props {
  notes: string;
}

/*
 * Notes per design.md 6.5. Section is omitted when notes is empty and the
 * page isn't in edit mode (locked refinement — see decisions.md 2026-05-28;
 * pending §6.5 doc-fix). In edit mode the section always renders so users
 * can add notes to a med that doesn't have any yet.
 */
export function MedicationNotesSection({ notes }: Props) {
  const editCtx = useMaybeMedicationEdit();
  const editing = editCtx?.editing ?? false;

  if (!notes && !editing) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Notes
      </h2>
      {editing ? (
        <InlineField
          fieldKey="notes"
          value={notes}
          variant="textarea"
          required={false}
          clearable
          ariaLabel="Notes"
          placeholder="How to take, observed side effects, compliance issues."
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
