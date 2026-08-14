"use client";

import { VisitInlineField } from "@/components/visits/visit-inline-field";
import { useMaybeVisitEdit } from "@/components/visits/visit-edit-context";

interface Props {
  notes: string;
}

/*
 * Notes per design.md §6.7 section 4 — the caregiver's own free-form markdown,
 * distinct from the body's doctor-said narrative. Omitted when empty outside
 * edit mode (same locked refinement as the state entities); always rendered in
 * edit mode so notes can be added. Clones allergy-notes-section.tsx.
 */
export function VisitNotesSection({ notes }: Props) {
  const editCtx = useMaybeVisitEdit();
  const editing = editCtx?.editing ?? false;

  if (!notes && !editing) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Notes
      </h2>
      {/* VisitInlineField self-manages display vs editor (click-to-edit,
          decisions.md 2026-08-13) — no editing branch needed here. */}
      <VisitInlineField
        fieldKey="notes"
        value={notes}
        variant="textarea"
        required={false}
        clearable
        ariaLabel="Notes"
        placeholder="Your own observations — how he seemed, what the doctor didn't say."
        displayValue={
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {notes}
          </p>
        }
      />
    </section>
  );
}
