"use client";

import { useRouter } from "next/navigation";
import { type ReactNode } from "react";

import { useEpisodeEdit } from "@/components/symptoms/episode-edit-context";
import { NOT_SET } from "@/components/symptoms/symptom-options";
import { InlineDisplayTarget } from "@/components/log-change-affordance";
import { useInlineEdit, type ToWire } from "@/components/use-inline-edit";
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
 * Per-cell editable primitive on the SymptomEpisode detail page. Two ways in
 * (decisions.md 2026-08-13):
 *  - click the value itself — that one field self-activates its editor,
 *    focused; blur/select commits and returns it to display
 *  - the header Edit toggle — every field activates at once (bulk fix-ups)
 *
 * State + commit mechanics live in the shared useInlineEdit hook; this file
 * owns the episode field map and the rendered controls, plus two variants the
 * episode needs: `datetime` (the timestamptz started/ended fields — input is
 * datetime-local via toDraft, the wire value is a full ISO string) and
 * `number` (duration in minutes — the wire value is a JS number or null,
 * matching the PATCH schema).
 *
 * The field set is the FULL episode PATCH surface — events have no change log,
 * so nothing routes through a `+ Log a change` dialog (§6.7: Edit corrects the
 * event in place). startedAt is required + not clearable; everything else clears.
 */

type Variant = "text" | "textarea" | "datetime" | "number" | "select";

interface InlineFieldProps {
  fieldKey:
    | "startedAt"
    | "endedAt"
    | "durationMinutes"
    | "severity"
    | "description"
    | "triggers"
    | "relief"
    | "linkedVisitId"
    | "notes";
  /** Stored value: ISO string for datetime, plain string/number-string otherwise. */
  value: string | null;
  variant: Variant;
  required: boolean;
  clearable: boolean;
  displayValue: ReactNode;
  /**
   * True when displayValue is itself interactive (the linked-visit link;
   * navigation wins) — the at-rest display then gets a hover-revealed ✎
   * instead of the full click-to-edit wrap.
   */
  displayIsInteractive?: boolean;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  ariaLabel: string;
  options?: ReadonlyArray<{ value: string; label: string }>;
  rows?: number;
}

// Stored ISO → datetime-local input value ("YYYY-MM-DDTHH:mm", browser tz).
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Raw stored value → the input's display string for this variant.
function toInputValue(variant: Variant, raw: string | null): string {
  if (raw === null) return "";
  if (variant === "datetime") return toDatetimeLocal(raw);
  return raw;
}

export function EpisodeInlineField({
  fieldKey,
  value: initialValue,
  variant,
  required,
  clearable,
  displayValue,
  displayIsInteractive = false,
  className,
  inputClassName,
  placeholder,
  ariaLabel,
  options,
  rows,
}: InlineFieldProps) {
  const { editing, episodeId } = useEpisodeEdit();
  const router = useRouter();

  // Build the wire value per variant.
  const toWire = (nextInput: string): ToWire => {
    if (!nextInput) return { value: clearable ? null : "" };
    if (variant === "datetime") {
      const d = new Date(nextInput);
      if (Number.isNaN(d.getTime())) {
        return { error: "Enter a valid date and time." };
      }
      return { value: d.toISOString() };
    }
    if (variant === "number") {
      const n = Number(nextInput);
      if (!Number.isInteger(n) || n <= 0) {
        return { error: "Enter a whole number of minutes." };
      }
      return { value: n };
    }
    return { value: nextInput };
  };

  const field = useInlineEdit({
    initialValue,
    // Also the no-op baseline + Escape-revert target, so datetime drafts
    // round-trip through the local form, not the raw ISO.
    toDraft: (v) => toInputValue(variant, v),
    fieldKey,
    required,
    ariaLabel,
    editing,
    endpoint: `/api/symptom-episodes/${episodeId}`,
    toWire,
    onSaved: () => router.refresh(),
  });

  if (!field.active) {
    return (
      <InlineDisplayTarget
        interactive={displayIsInteractive}
        ariaLabel={ariaLabel}
        onActivate={field.activate}
      >
        {displayValue}
      </InlineDisplayTarget>
    );
  }

  if (variant === "select") {
    const items = clearable
      ? [{ value: NOT_SET, label: "—" }, ...(options ?? [])]
      : [...(options ?? [])];
    const selectValue = clearable ? field.draft || NOT_SET : field.draft || null;
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
          {/* w-auto over the default anchor-width pin: these selects sit in
              narrow grid cells, and long labels (visit descriptions) would
              clip. Anchor width stays the floor; max-w-sm caps growth. */}
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

  const inputType =
    variant === "datetime" ? "datetime-local" : variant === "number" ? "number" : "text";

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Input
        type={inputType}
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
