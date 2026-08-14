"use client";

import { useRouter } from "next/navigation";
import { type ReactNode } from "react";

import { CATEGORY_OPTIONS } from "@/components/allergies/allergy-options";
import { useAllergyEdit } from "@/components/allergies/allergy-edit-context";
import { NOT_SET } from "@/components/conditions/condition-options";
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
 * Per-cell editable primitive on the Allergy detail page. Two ways in
 * (decisions.md 2026-08-13):
 *  - click the value itself — that one field self-activates its editor,
 *    focused; blur/select commits and returns it to display
 *  - the header Edit toggle — every field activates at once (bulk fix-ups)
 *
 * State + commit mechanics live in the shared useInlineEdit hook; this file
 * owns the allergy field map and the rendered controls. Each commit fires a
 * discrete PATCH /api/allergies/[id] with one key and router.refresh()'s on
 * success. Errors keep the editor active so they stay visible; Escape
 * reverts, Enter commits (single-line variants).
 *
 * Field set is the Allergy non-clinical PATCH surface: substance / category /
 * reaction / firstNoted / confirmedBy / notes. status / severity are
 * change-logged (route through `+ Log a change`) and are not editable here.
 *
 * category is required + NOT clearable — the column is NOT NULL (§4:259);
 * recategorizing is allowed, clearing is not. confirmedBy uses the
 * select-doctor variant with the "—" clear row (PATCH null).
 */

type Variant = "text" | "textarea" | "date" | "select-category" | "select-doctor";

interface InlineFieldProps {
  fieldKey:
    | "substance"
    | "category"
    | "reaction"
    | "firstNoted"
    | "confirmedBy"
    | "notes";
  value: string | null;
  variant: Variant;
  required: boolean;
  clearable: boolean;
  displayValue: ReactNode;
  /**
   * True when displayValue is itself interactive (the confirmedBy doctor
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

export function AllergyInlineField({
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
  const { editing, allergyId } = useAllergyEdit();
  const router = useRouter();

  const field = useInlineEdit({
    initialValue,
    fieldKey,
    required,
    ariaLabel,
    editing,
    endpoint: `/api/allergies/${allergyId}`,
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

  // Select variants commit on value change instead of blur. `items` is passed
  // to the Select root so Base UI's <SelectValue> renders the option label.
  if (variant === "select-category") {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <Select
          // null, not undefined: Base UI's controlled empty value is null.
          value={field.draft || null}
          items={CATEGORY_OPTIONS}
          disabled={field.pending}
          // Self-activation goes straight to the open option list — the click
          // on the value IS the click on the trigger.
          defaultOpen={field.selfActive}
          onOpenChange={field.selectOpenChange}
          onValueChange={(next) => field.commitFromSelect(next ?? "")}
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
            {CATEGORY_OPTIONS.map((opt) => (
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

  // Same commit-on-change shape; the sentinel row clears the field
  // (clearable → PATCH null).
  if (variant === "select-doctor") {
    const doctorItems = [{ value: NOT_SET, label: "—" }, ...(options ?? [])];
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
          {/* w-auto over the default anchor-width pin: narrow cells clip long
              labels (doctor "Name · Specialty"). Anchor width stays the
              floor; max-w-sm caps growth. */}
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
