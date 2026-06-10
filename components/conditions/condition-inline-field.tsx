"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { CATEGORY_OPTIONS } from "@/components/conditions/condition-options";
import { useConditionEdit } from "@/components/conditions/condition-edit-context";
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
 * medication/inline-field.tsx. Click into a field while edit mode is on, type,
 * blur → PATCH /api/conditions/[id].
 *
 * Per design.md 9.6:2787, single-field inline edits use the useState + onBlur
 * pattern (not RHF). Each blur fires a discrete PATCH with one key; the page
 * router.refresh()'s on success so the next render shows server truth. On
 * failure, the inline error renders under the field and the local value is kept.
 *
 * Field set is the Condition non-clinical PATCH surface: name / category /
 * diagnosedOn / notes. status / severity / managingDoctor are change-logged
 * (route through `+ Log a change`), and diagnosedBy needs the doctor picker that
 * lands with the Doctor entity — none of those are editable here.
 *
 * Skips the PATCH when the value hasn't changed from initial, or when a required
 * field is blanked. For clearable fields, an empty value PATCHes `null` (matches
 * the API schema's `.nullable()` treatment).
 */

type Variant = "text" | "textarea" | "date" | "select-category";

interface InlineFieldProps {
  fieldKey: "name" | "category" | "diagnosedOn" | "notes";
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

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: {
      fieldErrors?: Record<string, string[]>;
      formErrors?: string[];
    };
  };
}

export function ConditionInlineField({
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
  const { editing, conditionId } = useConditionEdit();
  const router = useRouter();
  const [draft, setDraft] = useState<string>(initialValue ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sync local draft when the upstream value changes (router.refresh after a
  // successful PATCH, or a parallel write). Adjusting state during render per
  // React's "you might not need an effect" guidance.
  const [prevInitial, setPrevInitial] = useState<string | null>(initialValue);
  if (initialValue !== prevInitial) {
    setPrevInitial(initialValue);
    setDraft(initialValue ?? "");
    setError(null);
  }

  if (!editing) {
    return <>{displayValue}</>;
  }

  const commit = async (next: string) => {
    const initialStr = initialValue ?? "";
    if (next === initialStr) return; // no-op
    if (!next && required) {
      setError(`${ariaLabel} is required.`);
      return;
    }

    const wireValue: string | null = next === "" && clearable ? null : next;
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/conditions/${conditionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [fieldKey]: wireValue }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      const parsed = (await res.json().catch(() => ({}))) as ApiErrorBody;
      const fieldMsg = parsed.error?.details?.fieldErrors?.[fieldKey]?.[0];
      setError(fieldMsg ?? parsed.error?.message ?? "Couldn't save.");
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setPending(false);
    }
  };

  // Select variant commits on value change instead of blur. `items` is passed
  // to the Select root so Base UI's <SelectValue> renders the option label
  // (not the raw enum value) on the trigger.
  if (variant === "select-category") {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <Select
          value={draft || undefined}
          items={CATEGORY_OPTIONS}
          disabled={pending}
          onValueChange={(next) => {
            const v = next ?? "";
            setDraft(v);
            void commit(v);
          }}
        >
          <SelectTrigger
            aria-label={ariaLabel}
            className={cn("w-full", inputClassName)}
          >
            <SelectValue placeholder={placeholder ?? "Select…"} />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  if (variant === "textarea") {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <Textarea
          value={draft}
          aria-label={ariaLabel}
          rows={4}
          placeholder={placeholder}
          disabled={pending}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit(draft)}
          className={inputClassName}
        />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Input
        type={variant === "date" ? "date" : "text"}
        value={draft}
        aria-label={ariaLabel}
        placeholder={placeholder}
        autoComplete="off"
        disabled={pending}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit(draft)}
        className={inputClassName}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
