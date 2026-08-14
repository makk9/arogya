"use client";

import { AllergyInlineField } from "@/components/allergies/allergy-inline-field";
import { useMaybeAllergyEdit } from "@/components/allergies/allergy-edit-context";

interface Props {
  notes: string;
}

/*
 * Notes per design.md 6.5. Section is omitted when notes is empty and the page
 * isn't in edit mode (locked refinement; pending §6.5 doc-fix). In edit mode
 * the section always renders so users can add notes to an allergy that doesn't
 * have any yet. Clones condition-notes-section.tsx.
 */
export function AllergyNotesSection({ notes }: Props) {
  const editCtx = useMaybeAllergyEdit();
  const editing = editCtx?.editing ?? false;

  if (!notes && !editing) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Notes
      </h2>
      {/* AllergyInlineField self-manages display vs editor (click-to-edit,
          decisions.md 2026-08-13) — no editing branch needed here. */}
      <AllergyInlineField
        fieldKey="notes"
        value={notes}
        variant="textarea"
        required={false}
        clearable
        ariaLabel="Notes"
        placeholder="How it was discovered, what to avoid, cross-reactions a doctor flagged."
        displayValue={
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {notes}
          </p>
        }
      />
    </section>
  );
}
