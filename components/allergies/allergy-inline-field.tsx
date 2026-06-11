"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { CATEGORY_OPTIONS } from "@/components/allergies/allergy-options";
import { useAllergyEdit } from "@/components/allergies/allergy-edit-context";
import { NOT_SET } from "@/components/conditions/condition-options";
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
 * Per-cell editable primitive on the Allergy detail page. Clones
 * condition-inline-field.tsx. Click into a field while edit mode is on, type,
 * blur → PATCH /api/allergies/[id].
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
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  ariaLabel: string;
  /** Option rows for the select-doctor variant (value = doctor uuid). */
  options?: ReadonlyArray<{ value: string; label: string }>;
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

export function AllergyInlineField({
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
}: InlineFieldProps) {
  const { editing, allergyId } = useAllergyEdit();
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
      const res = await fetch(`/api/allergies/${allergyId}`, {
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

  // Select variants commit on value change instead of blur. `items` is passed
  // to the Select root so Base UI's <SelectValue> renders the option label.
  if (variant === "select-category") {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <Select
          // null, not undefined: Base UI's controlled empty value is null.
          value={draft || null}
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

  // Same commit-on-change shape; the sentinel row clears the field
  // (clearable → PATCH null).
  if (variant === "select-doctor") {
    const doctorItems = [{ value: NOT_SET, label: "—" }, ...(options ?? [])];
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <Select
          value={draft || NOT_SET}
          items={doctorItems}
          disabled={pending}
          onValueChange={(next) => {
            const v = next === NOT_SET || !next ? "" : next;
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
            {doctorItems.map((opt) => (
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
