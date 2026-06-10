"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import {
  CATEGORY_OPTIONS,
  FORM_OPTIONS,
} from "@/components/medications/medication-options";
import { useMedicationEdit } from "@/components/medications/medication-edit-context";
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
 * Per-cell editable primitive on the Medication detail page. Click into a
 * field while edit mode is on, type, blur → PATCH /api/medications/[id].
 *
 * Per design.md 9.6:2787, single-field inline edits use the useState + onBlur
 * pattern (not RHF). Each blur fires a discrete PATCH with one key; the page
 * router.refresh()'s on success so the next render shows server truth. On
 * failure, the inline error renders under the field and the local value is
 * kept (re-render pulls server state if the user navigates away or refreshes).
 *
 * Skips the PATCH when the value hasn't changed from initial, or when a
 * required field is blanked. For clearable fields, an empty value PATCHes
 * `null` (matches the API schema's `.nullable()` treatment).
 */

type Variant = "text" | "textarea" | "date" | "select-form" | "select-category";

interface InlineFieldProps {
  fieldKey:
    | "name"
    | "brandName"
    | "form"
    | "category"
    | "startedOn"
    | "notes";
  value: string | null;
  variant: Variant;
  required: boolean;
  clearable: boolean;
  displayValue: ReactNode;
  // Visual flags — keep the inline input aligned with the surrounding text.
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

export function InlineField({
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
  const { editing, medicationId } = useMedicationEdit();
  const router = useRouter();
  const [draft, setDraft] = useState<string>(initialValue ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sync local draft when the upstream value changes (router.refresh after a
  // successful PATCH, or a parallel write). Adjusting state during render per
  // React's "you might not need an effect" guidance — cheaper than useEffect
  // and avoids the lint rule against setState-in-effect.
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
      const res = await fetch(`/api/medications/${medicationId}`, {
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

  // Select variants don't blur the same way as text inputs — they commit on
  // value change instead.
  if (variant === "select-form" || variant === "select-category") {
    const options =
      variant === "select-form" ? FORM_OPTIONS : CATEGORY_OPTIONS;
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <Select
          // null, not undefined: Base UI's controlled empty value is null —
          // undefined makes the Select uncontrolled, and the first pick flips it
          // to controlled (console warning).
          value={draft || null}
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
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : null}
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
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : null}
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
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
