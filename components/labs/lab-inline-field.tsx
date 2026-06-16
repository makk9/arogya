"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { NOT_SET } from "@/components/conditions/condition-options";
import { useLabEdit } from "@/components/labs/lab-edit-context";
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
 * Per-cell editable primitive for the REPORT-LEVEL fields on the Lab detail
 * page (§6.7 Edit corrects the report row in place). Clones
 * visit-inline-field.tsx. The MARKERS table is NOT edited through this — marker
 * corrections route through the dedicated correction dialog, not the report
 * PATCH (§6.7 markers are read-only on the report surface).
 *
 * reportDate is required + NOT clearable (NOT NULL column); reportType /
 * labName / orderedBy / summary / notes clear to null.
 */

type Variant = "text" | "textarea" | "date" | "select";

interface InlineFieldProps {
  fieldKey:
    | "reportDate"
    | "reportType"
    | "labName"
    | "orderedBy"
    | "summary"
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
  options?: ReadonlyArray<{ value: string; label: string }>;
  rows?: number;
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

export function LabInlineField({
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
  rows,
}: InlineFieldProps) {
  const { editing, reportId } = useLabEdit();
  const router = useRouter();
  const [draft, setDraft] = useState<string>(initialValue ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sync local draft when the upstream value changes (router.refresh after a
  // successful PATCH). Adjusting state during render per React's "you might not
  // need an effect" guidance.
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
      const res = await fetch(`/api/lab-reports/${reportId}`, {
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

  if (variant === "select") {
    const items = clearable
      ? [{ value: NOT_SET, label: "—" }, ...(options ?? [])]
      : [...(options ?? [])];
    const selectValue = clearable ? draft || NOT_SET : draft || null;
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <Select
          value={selectValue}
          items={items}
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
            {items.map((opt) => (
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
          rows={rows ?? 4}
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
