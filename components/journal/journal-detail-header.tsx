"use client";

import type { ReactNode } from "react";

import { MOOD_LABEL, MOOD_OPTIONS } from "@/components/journal/journal-options";
import { JournalInlineField } from "@/components/journal/journal-inline-field";
import { useMaybeJournalEdit } from "@/components/journal/journal-edit-context";
import { Button } from "@/components/ui/button";
import type { JournalEntry } from "@/db/schema";
import { formatAbsoluteDate } from "@/lib/datetime";
import { journalDisplayTitle } from "@/lib/journal";

interface Props {
  patientId: string;
  entry: JournalEntry;
  actionsSlot: ReactNode | null;
}

/*
 * Event detail header per design.md §6.7 page shell. Title is the entry's own
 * title, or `(untitled)` (§6.7:1535). No type pill (§6.7:1517 — none for
 * Journal). A mood pill sits beside the title when set. Subtitle is the §6.7:1500
 * capture context for Journal: "written by you" + the entry date.
 *
 * Edit mode swaps title / date / mood into inline fields — the full event row is
 * correctable in place (§6.7: Edit corrects the row, no change log). Breadcrumb
 * renders the §6.7 date slug rather than the row uuid.
 */
export function JournalDetailHeader({ patientId, entry, actionsSlot }: Props) {
  const editCtx = useMaybeJournalEdit();
  const editing = editCtx?.editing ?? false;
  const setEditing = editCtx?.setEditing ?? (() => {});

  const moodLabel = entry.mood ? (MOOD_LABEL[entry.mood] ?? entry.mood) : null;
  const moodItems = MOOD_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

  return (
    <>
      <nav
        aria-label="breadcrumb"
        className="mb-6 font-mono text-xs text-muted-foreground"
      >
        / patient / {patientId.slice(0, 8)}… / journal / {entry.entryDate}
      </nav>

      <div className="mb-2 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <JournalInlineField
                fieldKey="title"
                value={entry.title}
                variant="text"
                required={false}
                clearable
                ariaLabel="Title"
                placeholder="Title (optional)…"
                displayValue={null}
                className="md:col-span-2"
              />
              <JournalInlineField
                fieldKey="entryDate"
                value={entry.entryDate}
                variant="date"
                required
                clearable={false}
                ariaLabel="Date"
                displayValue={null}
              />
              <JournalInlineField
                fieldKey="mood"
                value={entry.mood}
                variant="select"
                required={false}
                clearable
                ariaLabel="Mood"
                placeholder="Mood…"
                options={moodItems}
                displayValue={null}
              />
            </div>
          ) : (
            <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-heading text-2xl font-semibold leading-tight">
              <span className="border-b-2 border-destructive pb-1">
                {journalDisplayTitle(entry)}
              </span>
              {moodLabel ? (
                <span className="inline-flex items-baseline rounded-full border border-border bg-muted px-2 py-0.5 text-[0.55em] font-medium uppercase tracking-wide text-muted-foreground">
                  {moodLabel}
                </span>
              ) : null}
            </h1>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant={editing ? "default" : "outline"}
            size="sm"
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Done" : "Edit"}
          </Button>
          {actionsSlot}
        </div>
      </div>

      {!editing ? (
        <p className="mt-2 text-sm text-muted-foreground">
          written by you · {formatAbsoluteDate(entry.entryDate)}
        </p>
      ) : null}
    </>
  );
}
