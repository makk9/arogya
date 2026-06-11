"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { useLifestyleEdit } from "@/components/lifestyle/lifestyle-edit-context";
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
 * Per-cell editable primitive on the Lifestyle page. Clones
 * allergy-inline-field.tsx with two singleton twists:
 *  - PATCHes the fixed /api/lifestyle (no entity id)
 *  - adds a `tags` variant for dietRestrictions: comma-separated text in the
 *    input, string[] on the wire (or null when cleared)
 *
 * The CALLER decides whether a trend field renders this at all — a populated
 * trend field stays read-only in edit mode (route through `+ Log a change`);
 * an empty one renders this for first population (decisions.md 2026-06-10).
 * The server enforces the same rule, so a stale page degrades to a field
 * error, not a silent overwrite.
 */

type Variant = "text" | "textarea" | "tags" | "select";

interface InlineFieldProps {
  fieldKey:
    | "dietPattern"
    | "exercisePattern"
    | "sleepPattern"
    | "exerciseIntensity"
    | "stressLevel"
    | "tobaccoUse"
    | "alcoholUse"
    | "dietRestrictions"
    | "stressContext"
    | "notes";
  /** Tags variant gets the array pre-joined with ", " by the caller. */
  value: string | null;
  variant: Variant;
  clearable: boolean;
  displayValue: ReactNode;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  ariaLabel: string;
  /** Option rows for the select variant. */
  options?: ReadonlyArray<{ value: string; label: string }>;
}

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: {
      fieldErrors?: Record<string, string[]>;
      formErrors?: string[];
      rejectedFields?: Record<string, string>;
    };
  };
}

export function LifestyleInlineField({
  fieldKey,
  value: initialValue,
  variant,
  clearable,
  displayValue,
  className,
  inputClassName,
  placeholder,
  ariaLabel,
  options,
}: InlineFieldProps) {
  const { editing } = useLifestyleEdit();
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

    // tags: comma-separated input → trimmed string[]; empty → null.
    let wireValue: string | string[] | null;
    if (next === "" && clearable) {
      wireValue = null;
    } else if (variant === "tags") {
      const parts = next
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      wireValue = parts.length > 0 ? parts : null;
      if (wireValue === null && !clearable) return;
    } else {
      wireValue = next;
    }

    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/lifestyle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [fieldKey]: wireValue }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      const parsed = (await res.json().catch(() => ({}))) as ApiErrorBody;
      // The lock rejection's API copy names a POST endpoint (a teaching
      // surface for API callers); in the UI — reachable only via a stale page
      // whose field got populated elsewhere — say it in product terms.
      if (parsed.error?.details?.rejectedFields?.[fieldKey]) {
        setError(
          "This already has a value — use + Log a change in History to update it.",
        );
        return;
      }
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
  if (variant === "select") {
    const items = options ?? [];
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <Select
          // null, not undefined: Base UI's controlled empty value is null.
          value={draft || null}
          items={items}
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
          rows={3}
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
        type="text"
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
