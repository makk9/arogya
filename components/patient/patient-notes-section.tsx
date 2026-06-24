"use client";

import { useMaybePatientEdit } from "@/components/patient/patient-edit-context";
import { PatientInlineField } from "@/components/patient/patient-inline-field";

interface Props {
  notes: string;
}

/*
 * NOTES per design.md 6.10:1689 — the user's free-form editorial layer. Backed
 * by patients.notes (added in Phase D). Omitted when empty and not editing
 * (same locked refinement as the Medication notes section); in edit mode it
 * always renders so a note can be added to a profile that has none.
 *
 * The spec calls this "markdown"; like every other notes surface in v1 it's
 * stored as text and rendered pre-wrap (no markdown renderer yet — deferred,
 * consistent with the Medication/Lifestyle notes sections).
 */
export function PatientNotesSection({ notes }: Props) {
  const editing = useMaybePatientEdit()?.editing ?? false;

  if (!notes && !editing) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Notes
      </h2>
      {editing ? (
        <PatientInlineField
          fieldKey="notes"
          value={notes}
          variant="textarea"
          required={false}
          clearable
          ariaLabel="Notes"
          placeholder="Anything worth keeping at hand — care context, preferences, reminders."
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
