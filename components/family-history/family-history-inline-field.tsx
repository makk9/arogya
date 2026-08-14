"use client";

import { useRouter } from "next/navigation";
import { type ReactNode } from "react";

import { RELATION_OPTIONS } from "@/components/family-history/family-history-options";
import { useFamilyHistoryEdit } from "@/components/family-history/family-history-edit-context";
import { InlineDisplayTarget } from "@/components/log-change-affordance";
import {
  stringToWire,
  useInlineEdit,
  type ToWire,
} from "@/components/use-inline-edit";
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
 * Per-cell editable primitive on the FamilyHistory detail page. Two ways in
 * (decisions.md 2026-08-13):
 *  - click the value itself — that one field self-activates its editor,
 *    focused; blur/select commits and returns it to display
 *  - the header Edit toggle — every field activates at once (bulk fix-ups)
 *
 * State + commit mechanics live in the shared useInlineEdit hook; this file
 * owns the family-history field map and the rendered controls, PATCHing
 * /api/family-history/[id].
 *
 * Unlike every other state entity, the field set is the WHOLE column set —
 * FamilyHistory has no change log (§4:558), so nothing is locked behind a
 * `+ Log a change` route. New here: the `number` variant (ageOfOnset crosses
 * the wire as a number, not a string).
 *
 * relation is required + NOT clearable — the column is NOT NULL; re-assigning
 * is allowed, clearing is not.
 */

type Variant = "text" | "textarea" | "number" | "select-relation";

interface InlineFieldProps {
  fieldKey:
    | "relation"
    | "relationSpecific"
    | "conditionName"
    | "ageOfOnset"
    | "outcome"
    | "notes";
  value: string | null;
  variant: Variant;
  required: boolean;
  clearable: boolean;
  displayValue: ReactNode;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  ariaLabel: string;
}

export function FamilyHistoryInlineField({
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
}: InlineFieldProps) {
  const { editing, entryId } = useFamilyHistoryEdit();
  const router = useRouter();

  // The number variant crosses the wire as a number (or null when cleared);
  // everything else as string|null.
  const numberToWire = (next: string): ToWire => {
    if (next === "" && clearable) return { value: null };
    const parsed = Number(next);
    if (!Number.isInteger(parsed)) return { error: "Enter an age in years." };
    return { value: parsed };
  };

  const field = useInlineEdit({
    initialValue,
    fieldKey,
    required,
    ariaLabel,
    editing,
    endpoint: `/api/family-history/${entryId}`,
    toWire: variant === "number" ? numberToWire : stringToWire(clearable),
    onSaved: () => router.refresh(),
  });

  if (!field.active) {
    return (
      <InlineDisplayTarget ariaLabel={ariaLabel} onActivate={field.activate}>
        {displayValue}
      </InlineDisplayTarget>
    );
  }

  // Select variant commits on value change instead of blur. `items` is passed
  // to the Select root so Base UI's <SelectValue> renders the option label.
  if (variant === "select-relation") {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <Select
          // null, not undefined: Base UI's controlled empty value is null.
          value={field.draft || null}
          items={RELATION_OPTIONS}
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
          {/* w-auto over the default anchor-width pin: this select sits in a
              narrow grid cell, and long relation labels would clip. Anchor
              width stays the floor; max-w-sm caps growth. */}
          <SelectContent className="w-auto min-w-(--anchor-width) max-w-sm">
            {RELATION_OPTIONS.map((opt) => (
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
        type={variant === "number" ? "number" : "text"}
        inputMode={variant === "number" ? "numeric" : undefined}
        min={variant === "number" ? 0 : undefined}
        max={variant === "number" ? 130 : undefined}
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
