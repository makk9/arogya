"use client";

import ReactMarkdown from "react-markdown";

import { JournalInlineField } from "@/components/journal/journal-inline-field";
import { useMaybeJournalEdit } from "@/components/journal/journal-edit-context";
import type { JournalEntry } from "@/db/schema";

/*
 * The §6.7 body section, per-entity header name: ENTRY. Renders the entry's
 * markdown (`content`, §4:505) through react-markdown so the §6.7:1535 "bolded
 * key phrases" pattern works. `content` is NOT NULL — there's always something
 * to show, so no empty-state invitation (unlike Visit/Report bodies). Edit mode
 * swaps in the textarea.
 *
 * No Notes section follows — for Journal the body IS the note (§6.7:1527/1535).
 */

interface Props {
  entry: JournalEntry;
}

const MARKDOWN_CLASS =
  "text-sm leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-0.5";

export function JournalBodySection({ entry }: Props) {
  const editCtx = useMaybeJournalEdit();
  const editing = editCtx?.editing ?? false;

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Entry
      </h2>

      {editing ? (
        <JournalInlineField
          fieldKey="content"
          value={entry.content}
          variant="textarea"
          rows={14}
          required
          clearable={false}
          ariaLabel="Entry"
          placeholder="Write whatever's on your mind."
          displayValue={null}
        />
      ) : (
        <div className={MARKDOWN_CLASS}>
          <ReactMarkdown>{entry.content}</ReactMarkdown>
        </div>
      )}
    </section>
  );
}
