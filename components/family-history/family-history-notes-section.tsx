"use client";

import { FamilyHistoryInlineField } from "@/components/family-history/family-history-inline-field";
import { useMaybeFamilyHistoryEdit } from "@/components/family-history/family-history-edit-context";

interface Props {
  notes: string;
}

/*
 * Notes per design.md 6.5:1404 — "the most-used part" of the FamilyHistory
 * detail (family stories, onset details that don't fit structured fields).
 * Section is omitted when notes is empty and the page isn't in edit mode
 * (locked refinement; pending §6.5 doc-fix). Clones allergy-notes-section.tsx.
 */
export function FamilyHistoryNotesSection({ notes }: Props) {
  const editCtx = useMaybeFamilyHistoryEdit();
  const editing = editCtx?.editing ?? false;

  if (!notes && !editing) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Notes
      </h2>
      {editing ? (
        <FamilyHistoryInlineField
          fieldKey="notes"
          value={notes}
          variant="textarea"
          required={false}
          clearable
          ariaLabel="Notes"
          placeholder="Family context a doctor might ask about — how it was discovered, how it progressed."
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
