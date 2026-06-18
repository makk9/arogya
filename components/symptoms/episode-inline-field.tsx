"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { useEpisodeEdit } from "@/components/symptoms/episode-edit-context";
import { NOT_SET } from "@/components/symptoms/symptom-options";
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
 * Per-cell editable primitive on the SymptomEpisode detail page. Clones
 * visit-inline-field and adds two variants the episode needs: `datetime` (the
 * timestamptz started/ended fields — input is datetime-local, the wire value is
 * a full ISO string) and `number` (duration in minutes — the wire value is a JS
 * number or null, matching the PATCH schema).
 *
 * The field set is the FULL episode PATCH surface — events have no change log,
 * so nothing routes through a `+ Log a change` dialog (§6.7: Edit corrects the
 * event in place). startedAt is required + not clearable; everything else clears.
 */

type Variant = "text" | "textarea" | "datetime" | "number" | "select";

interface InlineFieldProps {
  fieldKey:
    | "startedAt"
    | "endedAt"
    | "durationMinutes"
    | "severity"
    | "description"
    | "triggers"
    | "relief"
    | "linkedVisitId"
    | "notes";
  /** Stored value: ISO string for datetime, plain string/number-string otherwise. */
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

// Stored ISO → datetime-local input value ("YYYY-MM-DDTHH:mm", browser tz).
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Raw stored value → the input's display string for this variant.
function toInputValue(variant: Variant, raw: string | null): string {
  if (raw === null) return "";
  if (variant === "datetime") return toDatetimeLocal(raw);
  return raw;
}

export function EpisodeInlineField({
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
  const { editing, episodeId } = useEpisodeEdit();
  const router = useRouter();
  const initialInput = toInputValue(variant, initialValue);
  const [draft, setDraft] = useState<string>(initialInput);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sync local draft when upstream value changes (router.refresh after PATCH).
  const [prevInitial, setPrevInitial] = useState<string | null>(initialValue);
  if (initialValue !== prevInitial) {
    setPrevInitial(initialValue);
    setDraft(toInputValue(variant, initialValue));
    setError(null);
  }

  if (!editing) {
    return <>{displayValue}</>;
  }

  const commit = async (nextInput: string) => {
    if (nextInput === initialInput) return; // no-op
    if (!nextInput && required) {
      setError(`${ariaLabel} is required.`);
      return;
    }

    // Build the wire value per variant.
    let wireValue: string | number | null;
    if (!nextInput) {
      wireValue = clearable ? null : "";
    } else if (variant === "datetime") {
      const d = new Date(nextInput);
      if (Number.isNaN(d.getTime())) {
        setError("Enter a valid date and time.");
        return;
      }
      wireValue = d.toISOString();
    } else if (variant === "number") {
      const n = Number(nextInput);
      if (!Number.isInteger(n) || n <= 0) {
        setError("Enter a whole number of minutes.");
        return;
      }
      wireValue = n;
    } else {
      wireValue = nextInput;
    }

    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/symptom-episodes/${episodeId}`, {
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

  const inputType =
    variant === "datetime" ? "datetime-local" : variant === "number" ? "number" : "text";

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Input
        type={inputType}
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
