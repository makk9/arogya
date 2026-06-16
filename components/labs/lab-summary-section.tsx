"use client";

import ReactMarkdown from "react-markdown";

import { LabInlineField } from "@/components/labs/lab-inline-field";
import { useMaybeLabEdit } from "@/components/labs/lab-edit-context";

/*
 * §6.7 lab `summary` (Phase 4: doctor's interpretation if attached, or
 * AI-generated on extract). Rendered as a short interpretation lead-in above
 * the MARKERS table — markdown so the §6.7 "bolded key data" pattern bolds.
 * Inline-editable in edit mode; omitted when empty outside it (same omission
 * rule as Notes). Distinct from Notes (the caregiver's own context).
 */

interface Props {
  summary: string;
}

const MARKDOWN_CLASS =
  "text-sm leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-0.5";

export function LabSummarySection({ summary }: Props) {
  const editCtx = useMaybeLabEdit();
  const editing = editCtx?.editing ?? false;

  if (!summary && !editing) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Summary
      </h2>
      {editing ? (
        <LabInlineField
          fieldKey="summary"
          value={summary}
          variant="textarea"
          rows={4}
          required={false}
          clearable
          ariaLabel="Summary"
          placeholder="The interpretation attached to this report, if any."
          displayValue={null}
        />
      ) : (
        <div className={MARKDOWN_CLASS}>
          <ReactMarkdown>{summary}</ReactMarkdown>
        </div>
      )}
    </section>
  );
}
