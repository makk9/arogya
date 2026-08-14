"use client";

import { DoctorInlineField } from "@/components/doctors/doctor-inline-field";
import { useMaybeDoctorEdit } from "@/components/doctors/doctor-edit-context";

interface Props {
  notes: string;
}

/*
 * Notes per design.md 6.5. Section is omitted when notes is empty and the page
 * isn't in edit mode (locked refinement — decisions.md 2026-05-28; pending §6.5
 * doc-fix). In edit mode the section always renders so users can add notes to a
 * doctor that doesn't have any yet. Clones condition-notes-section.tsx.
 */
export function DoctorNotesSection({ notes }: Props) {
  const editCtx = useMaybeDoctorEdit();
  const editing = editCtx?.editing ?? false;

  if (!notes && !editing) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Notes
      </h2>
      {/* DoctorInlineField self-manages display vs editor (click-to-edit,
          decisions.md 2026-08-13) — no editing branch needed here. */}
      <DoctorInlineField
        fieldKey="notes"
        value={notes}
        variant="textarea"
        required={false}
        clearable
        ariaLabel="Notes"
        placeholder="Languages, communication preferences, qualifications."
        displayValue={
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {notes}
          </p>
        }
      />
    </section>
  );
}
