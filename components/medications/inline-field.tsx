"use client";

import { useRouter } from "next/navigation";
import { type ReactNode } from "react";

import {
  CATEGORY_OPTIONS,
  FORM_OPTIONS,
} from "@/components/medications/medication-options";
import { useMedicationEdit } from "@/components/medications/medication-edit-context";
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
 * Per-cell editable primitive on the Medication detail page. Two ways in
 * (decisions.md 2026-08-13):
 *  - click the value itself — that one field self-activates its editor,
 *    focused; blur/select commits and returns it to display
 *  - the header Edit toggle — every field activates at once (bulk fix-ups)
 *
 * State + commit mechanics live in the shared useInlineEdit hook; this file
 * owns the medication field map and the rendered controls. Per design.md
 * 9.6:2793, single-field inline edits use the useState + onBlur pattern (not
 * RHF); each commit fires a discrete PATCH with one key and router.refresh()'s
 * on success. Errors keep the editor active so they stay visible; Escape
 * reverts, Enter commits (single-line variants).
 *
 * `locked` on the edit context (discontinued meds) disables self-activation —
 * the value renders inert, matching the frozen Edit button.
 */

type Variant =
  | "text"
  | "textarea"
  | "date"
  | "select-form"
  | "select-category"
  | "select-condition";

// Sentinel for the clearable selects' explicit "None" row (commits null).
const NONE_VALUE = "__none";

interface InlineFieldProps {
  fieldKey:
    | "name"
    | "brandName"
    | "form"
    | "category"
    | "purpose"
    | "startedOn"
    | "notes";
  value: string | null;
  variant: Variant;
  required: boolean;
  clearable: boolean;
  displayValue: ReactNode;
  /** Options for variant "select-condition" (value = uuid, label = name). */
  options?: ReadonlyArray<{ value: string; label: string }>;
  /**
   * True when displayValue is itself interactive (the treats condition link;
   * navigation wins) — the at-rest display then gets a hover-revealed ✎
   * instead of the full click-to-edit wrap.
   */
  displayIsInteractive?: boolean;
  // Visual flags — keep the inline input aligned with the surrounding text.
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  ariaLabel: string;
}

export function InlineField({
  fieldKey,
  value: initialValue,
  variant,
  required,
  clearable,
  displayValue,
  options,
  displayIsInteractive = false,
  className,
  inputClassName,
  placeholder,
  ariaLabel,
}: InlineFieldProps) {
  const { editing, medicationId, locked } = useMedicationEdit();
  const router = useRouter();

  const field = useInlineEdit({
    initialValue,
    fieldKey,
    required,
    ariaLabel,
    editing,
    endpoint: `/api/medications/${medicationId}`,
    toWire: stringToWire(clearable),
    onSaved: () => router.refresh(),
  });

  if (!field.active) {
    return (
      <InlineDisplayTarget
        locked={locked ?? false}
        interactive={displayIsInteractive}
        ariaLabel={ariaLabel}
        onActivate={field.activate}
      >
        {displayValue}
      </InlineDisplayTarget>
    );
  }

  // Select variants don't blur the same way as text inputs — they commit on
  // value change instead.
  if (
    variant === "select-form" ||
    variant === "select-category" ||
    variant === "select-condition"
  ) {
    const baseOptions =
      variant === "select-form"
        ? FORM_OPTIONS
        : variant === "select-category"
          ? CATEGORY_OPTIONS
          : (options ?? []);
    // Clearable selects carry an explicit None row — the only way a select
    // can express "clear this" (maps to a null PATCH).
    const items = clearable
      ? [{ value: NONE_VALUE, label: "None" }, ...baseOptions]
      : [...baseOptions];
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <Select
          // null, not undefined: Base UI's controlled empty value is null —
          // undefined makes the Select uncontrolled, and the first pick flips it
          // to controlled (console warning).
          value={field.draft || (clearable ? NONE_VALUE : null)}
          // items so the trigger renders the label, not the raw value — load-
          // bearing for select-condition, where the value is a uuid
          // (decisions.md 2026-06-02).
          items={items}
          disabled={field.pending}
          // Self-activation goes straight to the open option list — the click
          // on the value IS the click on the trigger.
          defaultOpen={field.selfActive}
          onOpenChange={field.selectOpenChange}
          onValueChange={(next) => {
            field.commitFromSelect(
              next == null || next === NONE_VALUE ? "" : next,
            );
          }}
        >
          <SelectTrigger
            aria-label={ariaLabel}
            className={cn("w-full", inputClassName)}
          >
            <SelectValue placeholder={placeholder ?? "Select…"} />
          </SelectTrigger>
          {/* w-auto over the default anchor-width pin: these selects sit in
              narrow grid cells, and long labels (condition names) would clip.
              Anchor width stays the floor; max-w-sm caps growth. */}
          <SelectContent className="w-auto min-w-(--anchor-width) max-w-sm">
            {variant === "select-condition" && baseOptions.length === 0 ? (
              <SelectItem value="__no-options" disabled>
                No conditions on file
              </SelectItem>
            ) : null}
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
          rows={4}
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
