"use client";

import { useRouter } from "next/navigation";
import { type ReactNode } from "react";

import { CATEGORY_OPTIONS, NOT_SET } from "@/components/conditions/condition-options";
import { useConditionEdit } from "@/components/conditions/condition-edit-context";
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
 * Per-cell editable primitive on the Condition detail page. Clones
 * medication/inline-field.tsx. Two ways in (decisions.md 2026-08-13):
 *  - click the value itself — that one field self-activates its editor,
 *    focused; blur/select commits and returns it to display
 *  - the header Edit toggle — every field activates at once (bulk fix-ups)
 *
 * State + commit mechanics live in the shared useInlineEdit hook; this file
 * owns the condition field map and the rendered controls. Per design.md
 * 9.6:2793, single-field inline edits use the useState + onBlur pattern (not
 * RHF); each commit fires a discrete PATCH with one key and router.refresh()'s
 * on success. Errors keep the editor active so they stay visible; Escape
 * reverts, Enter commits (single-line variants).
 *
 * Field set is the Condition non-clinical PATCH surface: name / category /
 * diagnosedOn / diagnosedBy / notes. status / severity / managingDoctor are
 * change-logged (route through `+ Log a change`) and are not editable here.
 * diagnosedBy uses the select-doctor variant (options = the patient's doctors,
 * passed by the caller) — settable since the Doctor entity landed. Its
 * explicit "—" row is the select's clear path (clearable → PATCH null).
 */

type Variant = "text" | "textarea" | "date" | "select-category" | "select-doctor";


interface InlineFieldProps {
  fieldKey: "name" | "category" | "diagnosedOn" | "diagnosedBy" | "notes";
  value: string | null;
  variant: Variant;
  required: boolean;
  clearable: boolean;
  displayValue: ReactNode;
  /**
   * True when displayValue is itself interactive (the diagnosedBy doctor
   * link; navigation wins) — the at-rest display then gets a hover-revealed ✎
   * instead of the full click-to-edit wrap.
   */
  displayIsInteractive?: boolean;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  ariaLabel: string;
  /** Option rows for the select-doctor variant (value = doctor uuid). */
  options?: ReadonlyArray<{ value: string; label: string }>;
}

export function ConditionInlineField({
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
}: InlineFieldProps) {
  const { editing, conditionId } = useConditionEdit();
  const router = useRouter();

  const field = useInlineEdit({
    initialValue,
    fieldKey,
    required,
    ariaLabel,
    editing,
    endpoint: `/api/conditions/${conditionId}`,
    toWire: stringToWire(clearable),
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

  // Select variant commits on value change instead of blur. `items` is passed
  // to the Select root so Base UI's <SelectValue> renders the option label
  // (not the raw enum value) on the trigger.
  if (variant === "select-category") {
    // Clearable → a "—" sentinel row, the only way a select can express
    // "clear this" (commits "" → PATCH null), same as select-doctor below.
    const categoryItems = clearable
      ? [{ value: NOT_SET, label: "—" }, ...CATEGORY_OPTIONS]
      : [...CATEGORY_OPTIONS];
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <Select
          // null, not undefined: Base UI's controlled empty value is null —
          // undefined makes the Select uncontrolled, and the first pick flips it
          // to controlled (console warning).
          value={field.draft || (clearable ? NOT_SET : null)}
          items={categoryItems}
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
              narrow grid cells, and long category labels would clip. Anchor
              width stays the floor; max-w-sm caps growth. */}
          <SelectContent className="w-auto min-w-(--anchor-width) max-w-sm">
            {categoryItems.map((opt) => (
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

  // Same commit-on-change shape as select-category; the sentinel row clears the
  // field (clearable → PATCH null).
  if (variant === "select-doctor") {
    const doctorItems = [
      { value: NOT_SET, label: "—" },
      ...(options ?? []),
    ];
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <Select
          value={field.draft || NOT_SET}
          items={doctorItems}
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
              narrow grid cells, and long labels (doctor name · specialty)
              would clip. Anchor width stays the floor; max-w-sm caps growth. */}
          <SelectContent className="w-auto min-w-(--anchor-width) max-w-sm">
            {doctorItems.map((opt) => (
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
