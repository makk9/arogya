"use client";

import { useRouter } from "next/navigation";
import { type ReactNode } from "react";

import { useLifestyleEdit } from "@/components/lifestyle/lifestyle-edit-context";
import { InlineDisplayTarget } from "@/components/log-change-affordance";
import {
  stringToWire,
  useInlineEdit,
  type ToWire,
} from "@/components/use-inline-edit";
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
 *
 * Two ways into the editor (decisions.md 2026-08-13): click the value itself
 * (that one field self-activates, focused) or the header Edit toggle. State
 * + commit mechanics live in the shared useInlineEdit hook; this file owns
 * the lifestyle field map and the rendered controls.
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

  // tags: comma-separated input → trimmed string[]; empty → null.
  const toWire = (next: string): ToWire => {
    if (variant !== "tags") return stringToWire(clearable)(next);
    if (next === "" && clearable) return { value: null };
    const parts = next
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (parts.length === 0 && !clearable) return { skip: true };
    return { value: parts.length > 0 ? parts : null };
  };

  const field = useInlineEdit({
    initialValue,
    fieldKey,
    required: false,
    ariaLabel,
    editing,
    endpoint: "/api/lifestyle",
    toWire,
    // The lock rejection's API copy names a POST endpoint (a teaching surface
    // for API callers); in the UI — reachable only via a stale page whose
    // field got populated elsewhere — say it in product terms.
    mapApiError: (body) =>
      body.error?.details?.rejectedFields?.[fieldKey]
        ? "This already has a value — use + Log a change in History to update it."
        : null,
    onSaved: () => router.refresh(),
  });

  if (!field.active) {
    return (
      <InlineDisplayTarget ariaLabel={ariaLabel} onActivate={field.activate}>
        {displayValue}
      </InlineDisplayTarget>
    );
  }

  // Select variant commits on value change instead of blur. `items` is passed
  // to the Select root so Base UI's <SelectValue> renders the option label.
  if (variant === "select") {
    const items = options ?? [];
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <Select
          // null, not undefined: Base UI's controlled empty value is null.
          value={field.draft || null}
          items={items}
          disabled={field.pending}
          // Self-activation goes straight to the open option list.
          defaultOpen={field.selfActive}
          onOpenChange={field.selectOpenChange}
          onValueChange={(next) => field.commitFromSelect(next ?? "")}
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
          rows={3}
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
        type="text"
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
