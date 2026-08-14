"use client";

import { useRouter } from "next/navigation";
import { type ReactNode } from "react";

import { useDoctorEdit } from "@/components/doctors/doctor-edit-context";
import { InlineDisplayTarget } from "@/components/log-change-affordance";
import { stringToWire, useInlineEdit } from "@/components/use-inline-edit";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/*
 * Per-cell editable primitive on the Doctor detail page — no select variants;
 * every PATCH-editable Doctor field is free text or a date. Two ways in
 * (decisions.md 2026-08-13):
 *  - click the value itself — that one field self-activates its editor,
 *    focused; blur commits and returns it to display
 *  - the header Edit toggle — every field activates at once (bulk fix-ups)
 *
 * State + commit mechanics live in the shared useInlineEdit hook; this file
 * owns the doctor field map and the rendered controls. Each commit fires a
 * discrete PATCH /api/doctors/[id] with one key and router.refresh()'s on
 * success. Errors keep the editor active so they stay visible; Escape
 * reverts, Enter commits (single-line variants).
 *
 * Field set is the Doctor non-logged PATCH surface: name / phone / email /
 * address / firstVisit / notes. specialty / clinic are change-logged (route
 * through `+ Log a change`), and last visit is derived from Visits — none of
 * those are editable here.
 */

type Variant = "text" | "textarea" | "date";

interface InlineFieldProps {
  fieldKey: "name" | "phone" | "email" | "address" | "firstVisit" | "notes";
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

export function DoctorInlineField({
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
  const { editing, doctorId } = useDoctorEdit();
  const router = useRouter();

  const field = useInlineEdit({
    initialValue,
    fieldKey,
    required,
    ariaLabel,
    editing,
    endpoint: `/api/doctors/${doctorId}`,
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
