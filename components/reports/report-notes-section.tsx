"use client";

import { ReportInlineField } from "@/components/reports/report-inline-field";
import { useMaybeReportEdit } from "@/components/reports/report-edit-context";

interface Props {
  notes: string;
}

/*
 * Notes per design.md §6.7 section 4 — the caregiver's own free-form annotations
 * (§4:492), distinct from the document body (REPORT CONTENT). Omitted when empty
 * outside edit mode (same locked refinement as the state entities); always
 * rendered in edit mode so notes can be added. Clones visit-notes-section.tsx.
 */
export function ReportNotesSection({ notes }: Props) {
  const editCtx = useMaybeReportEdit();
  const editing = editCtx?.editing ?? false;

  if (!notes && !editing) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Notes
      </h2>
      {editing ? (
        <ReportInlineField
          fieldKey="notes"
          value={notes}
          variant="textarea"
          required={false}
          clearable
          ariaLabel="Notes"
          placeholder="Your own annotations — why this document matters, what to follow up on."
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
