"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { useDoctorEdit } from "@/components/doctors/doctor-edit-context";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/*
 * Per-cell editable primitive on the Doctor detail page. Clones
 * condition-inline-field.tsx minus the select variant — every PATCH-editable
 * Doctor field is free text or a date. Click into a field while edit mode is
 * on, type, blur → PATCH /api/doctors/[id].
 *
 * Per design.md 9.6:2787, single-field inline edits use the useState + onBlur
 * pattern (not RHF). Each blur fires a discrete PATCH with one key; the page
 * router.refresh()'s on success so the next render shows server truth.
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
      const res = await fetch(`/api/doctors/${doctorId}`, {
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
