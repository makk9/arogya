"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { RELATION_OPTIONS } from "@/components/family-history/family-history-options";
import { useFamilyHistoryEdit } from "@/components/family-history/family-history-edit-context";
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
 * Per-cell editable primitive on the FamilyHistory detail page. Clones
 * allergy-inline-field.tsx. Click into a field while edit mode is on, type,
 * blur → PATCH /api/family-history/[id].
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

    // The number variant crosses the wire as a number (or null when cleared);
    // everything else as string|null.
    let wireValue: string | number | null;
    if (next === "" && clearable) {
      wireValue = null;
    } else if (variant === "number") {
      const parsed = Number(next);
      if (!Number.isInteger(parsed)) {
        setError("Enter an age in years.");
        return;
      }
      wireValue = parsed;
    } else {
      wireValue = next;
    }

    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/family-history/${entryId}`, {
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
  // to the Select root so Base UI's <SelectValue> renders the option label.
  if (variant === "select-relation") {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <Select
          // null, not undefined: Base UI's controlled empty value is null.
          value={draft || null}
          items={RELATION_OPTIONS}
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
            {RELATION_OPTIONS.map((opt) => (
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
        type={variant === "number" ? "number" : "text"}
        inputMode={variant === "number" ? "numeric" : undefined}
        min={variant === "number" ? 0 : undefined}
        max={variant === "number" ? 130 : undefined}
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
