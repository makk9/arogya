"use client";

import { useRouter } from "next/navigation";
import { type ReactNode } from "react";

import { useJournalEdit } from "@/components/journal/journal-edit-context";
import { NOT_SET } from "@/components/journal/journal-options";
import { InlineDisplayTarget } from "@/components/log-change-affordance";
import { stringToWire, useInlineEdit } from "@/components/use-inline-edit";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/*
 * Per-cell editable primitive on the Journal detail page. Clones
 * report-inline-field.tsx. Two ways in (decisions.md 2026-08-13):
 *  - click the value itself — that one field self-activates its editor,
 *    focused; blur/select commits and returns it to display
 *  - the header Edit toggle — every field activates at once (bulk fix-ups)
 *
 * State + commit mechanics live in the shared useInlineEdit hook; this file
 * owns the journal field map and the rendered controls.
 *
 * Field set is the FULL Journal PATCH surface — events have no change log, so
 * nothing routes through a `+ Log a change` dialog (§6.7: Edit corrects the
 * event in place). entryDate / content are required + NOT clearable (NOT NULL
 * columns); title and mood clear to null.
 */

type Variant = "text" | "textarea" | "date" | "select";

interface InlineFieldProps {
  fieldKey: "title" | "entryDate" | "content" | "mood";
  value: string | null;
  variant: Variant;
  required: boolean;
  clearable: boolean;
  displayValue: ReactNode;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  ariaLabel: string;
  options?: ReadonlyArray<{ value: string; label: string }>;
  rows?: number;
}

export function JournalInlineField({
  fieldKey,
  value: initialValue,
  variant,
  required,
  clearable,
  displayValue,
  className,
  inputClassName,
  placeholder,
  ariaLabel,
  options,
  rows,
}: InlineFieldProps) {
  const { editing, entryId } = useJournalEdit();
  const router = useRouter();

  const field = useInlineEdit({
    initialValue,
    fieldKey,
    required,
    ariaLabel,
    editing,
    endpoint: `/api/journal/${entryId}`,
    toWire: stringToWire(clearable),
    onSaved: () => router.refresh(),
  });

  if (!field.active) {
    return (
      <InlineDisplayTarget ariaLabel={ariaLabel} onActivate={field.activate}>
        {displayValue}
      </InlineDisplayTarget>
    );
  }

  if (variant === "select") {
    const items = clearable
      ? [{ value: NOT_SET, label: "—" }, ...(options ?? [])]
      : [...(options ?? [])];
    const selectValue = clearable
      ? field.draft || NOT_SET
      : field.draft || null;
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <Select
          value={selectValue}
          items={items}
          disabled={field.pending}
          // Self-activation goes straight to the open option list — the click
          // on the value IS the click on the trigger.
          defaultOpen={field.selfActive}
          onOpenChange={field.selectOpenChange}
          onValueChange={(next) => {
            field.commitFromSelect(next === NOT_SET || !next ? "" : next);
          }}
        >
          <SelectTrigger
            aria-label={ariaLabel}
            className={cn("w-full", inputClassName)}
          >
            <SelectValue placeholder={placeholder ?? "Select…"} />
          </SelectTrigger>
          {/* w-auto over the default anchor-width pin: narrow cells clip long
              labels. Anchor width stays the floor; max-w-sm caps growth. */}
          <SelectContent className="w-auto min-w-(--anchor-width) max-w-sm">
            {items.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {field.error ? (
          <p className="text-xs text-destructive">{field.error}</p>
        ) : null}
      </div>
    );
  }

  if (variant === "textarea") {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <Textarea
          value={field.draft}
          aria-label={ariaLabel}
          rows={rows ?? 4}
          placeholder={placeholder}
          disabled={field.pending}
          autoFocus={field.selfActive}
          onChange={(e) => field.setDraft(e.target.value)}
          onBlur={field.blurCommit}
          onKeyDown={field.keyDown({ enterCommits: false })}
          className={inputClassName}
        />
        {field.error ? (
          <p className="text-xs text-destructive">{field.error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Input
        type={variant === "date" ? "date" : "text"}
        value={field.draft}
        aria-label={ariaLabel}
        placeholder={placeholder}
        autoComplete="off"
        disabled={field.pending}
        autoFocus={field.selfActive}
        onChange={(e) => field.setDraft(e.target.value)}
        onBlur={field.blurCommit}
        onKeyDown={field.keyDown({ enterCommits: true })}
        className={inputClassName}
      />
      {field.error ? (
        <p className="text-xs text-destructive">{field.error}</p>
      ) : null}
    </div>
  );
}
