"use client";

import ReactMarkdown from "react-markdown";

import { TypeInlineField } from "@/components/symptoms/type-inline-field";
import { useMaybeTypeEdit } from "@/components/symptoms/type-edit-context";

interface Props {
  notes: string;
}

/*
 * Notes for the SymptomType — markdown (§4:450, "typical triggers, patient's
 * description"). Rendered through react-markdown in read mode so the §6.7
 * "bolded key data" pattern works; a textarea in edit mode. Omitted when empty
 * outside edit mode.
 */
const MARKDOWN_CLASS =
  "text-sm leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-0.5";

export function TypeNotesSection({ notes }: Props) {
  const editCtx = useMaybeTypeEdit();
  const editing = editCtx?.editing ?? false;

  if (!notes && !editing) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Notes
      </h2>
      {editing ? (
        <TypeInlineField
          fieldKey="notes"
          value={notes}
          variant="textarea"
          rows={4}
          required={false}
          clearable
          ariaLabel="Notes"
          placeholder="Typical triggers, how it usually presents, what tends to help."
          displayValue={
            <div className={MARKDOWN_CLASS}>
              <ReactMarkdown>{notes}</ReactMarkdown>
            </div>
          }
        />
      ) : (
        <div className={MARKDOWN_CLASS}>
          <ReactMarkdown>{notes}</ReactMarkdown>
        </div>
      )}
    </section>
  );
}
