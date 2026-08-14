"use client";

import { useRouter } from "next/navigation";
import { type ReactNode } from "react";

import { InlineDisplayTarget } from "@/components/log-change-affordance";
import { stringToWire, useInlineEdit } from "@/components/use-inline-edit";
import { NOT_SET } from "@/components/symptoms/symptom-options";
import { useTypeEdit } from "@/components/symptoms/type-edit-context";
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
 * Per-cell editable primitive on the SymptomType detail page. Two ways in
 * (decisions.md 2026-08-13):
 *  - click the value itself — that one field self-activates its editor,
 *    focused; blur/select commits and returns it to display
 *  - the header Edit toggle — every field activates at once (bulk fix-ups)
 *
 * State + commit mechanics live in the shared useInlineEdit hook; this file
 * owns the symptom-type field map and the rendered controls, PATCHing
 * /api/symptom-types/[id]. SymptomType has no change log, so every column is a
 * plain inline edit (§4 — no symptom_type_changes table). `name` is required +
 * not clearable (identity); status is required (enum, default active); the
 * rest clear to null.
 */

type Variant = "text" | "textarea" | "date" | "select";

interface InlineFieldProps {
  fieldKey: "name" | "status" | "bodyArea" | "linkedCondition" | "firstNoted" | "notes";
  value: string | null;
  variant: Variant;
  required: boolean;
  clearable: boolean;
  displayValue: ReactNode;
  /**
   * True when displayValue is itself interactive (the linked-condition link;
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

export function TypeInlineField({
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
  const { editing, typeId } = useTypeEdit();
  const router = useRouter();

  const field = useInlineEdit({
    initialValue,
    fieldKey,
    required,
    ariaLabel,
    editing,
    endpoint: `/api/symptom-types/${typeId}`,
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
          // Self-activation goes straight to the open option list.
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
          {/* w-auto over the anchor-width pin: narrow cells clip long labels. */}
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
