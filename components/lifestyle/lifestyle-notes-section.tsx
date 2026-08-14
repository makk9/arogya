"use client";

import { LifestyleInlineField } from "@/components/lifestyle/lifestyle-inline-field";
import { useMaybeLifestyleEdit } from "@/components/lifestyle/lifestyle-edit-context";

interface Props {
  notes: string;
}

/*
 * Notes per design.md 6.5. Section is omitted when notes is empty and the page
 * isn't in edit mode (locked refinement; pending §6.5 doc-fix). Clones
 * allergy-notes-section.tsx. Notes is a companion field — plain PATCH, always
 * editable in edit mode.
 */
export function LifestyleNotesSection({ notes }: Props) {
  const editCtx = useMaybeLifestyleEdit();
  const editing = editCtx?.editing ?? false;

  if (!notes && !editing) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Notes
      </h2>
      {/* InlineField self-manages display vs editor (click-to-edit,
          decisions.md 2026-08-13) — no editing branch needed here. */}
      <LifestyleInlineField
        fieldKey="notes"
        value={notes}
        variant="textarea"
        clearable
        ariaLabel="Notes"
        placeholder="Anything else about daily routine a doctor might ask about."
        displayValue={
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {notes}
          </p>
        }
      />
    </section>
  );
}
