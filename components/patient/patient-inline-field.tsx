"use client";

import { useState, type ReactNode } from "react";

import {
  BLOOD_TYPE_OPTIONS,
  SEX_OPTIONS,
} from "@/components/patient/patient-options";
import { useMaybePatientEdit } from "@/components/patient/patient-edit-context";
import { useInlineCommit } from "@/components/patient/use-inline-commit";
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
 * Per-cell editable primitive for the patient profile, mirroring the
 * Medication detail page's InlineField (design.md 9.6:2787 — single-field
 * inline edits use useState + onBlur, not RHF). Click into a field while edit
 * mode is on, type, blur → PATCH /api/patient (singleton, no id segment).
 *
 * The network edge (PATCH, refresh, pending, error) lives in useInlineCommit;
 * this component owns the draft, the required/clearable rules, and the per-
 * variant input. Skips the PATCH when the value is unchanged, or when a
 * required field is blanked. Clearable fields PATCH `null` on empty (matches
 * the schema's `.nullable()` columns).
 *
 * Height/weight are NOT handled here — they go through PatientMeasurementField
 * (unit conversion), so this field has no numeric variant.
 */

type Variant = "text" | "textarea" | "date" | "select-sex" | "select-blood-type";

type FieldKey =
  | "name"
  | "preferredName"
  | "sex"
  | "dateOfBirth"
  | "bloodType"
  | "city"
  | "country"
  | "notes";

interface InlineFieldProps {
  fieldKey: FieldKey;
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

export function PatientInlineField({
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
  const editCtx = useMaybePatientEdit();
  const editing = editCtx?.editing ?? false;
  const { pending, error, setError, commit } = useInlineCommit("/api/patient");
  const [draft, setDraft] = useState<string>(initialValue ?? "");
  // Sync local draft when upstream value changes (router.refresh after a
  // successful PATCH). setState-during-render per React's "you might not need
  // an effect" guidance — same pattern as the medication InlineField.
  const [prevInitial, setPrevInitial] = useState<string | null>(initialValue);
  if (initialValue !== prevInitial) {
    setPrevInitial(initialValue);
    setDraft(initialValue ?? "");
    setError(null);
  }

  if (!editing) {
    return <>{displayValue}</>;
  }

  const handleCommit = (next: string) => {
    const initialStr = initialValue ?? "";
    if (next === initialStr) return; // no-op
    if (!next && required) {
      setError(`${ariaLabel} is required.`);
      return;
    }
    const wireValue: string | null = next === "" && clearable ? null : next;
    void commit(fieldKey, wireValue);
  };

  if (variant === "select-sex" || variant === "select-blood-type") {
    const options =
      variant === "select-sex" ? SEX_OPTIONS : BLOOD_TYPE_OPTIONS;
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <Select
          // null, not undefined: Base UI's controlled empty value is null.
          value={draft || null}
          // items lets Base UI's SelectValue resolve the chosen value to its
          // label ("Male", not "male") — without it the trigger shows the raw
          // enum (the §verify-ui raw-value-instead-of-label bug).
          items={options}
          disabled={pending}
          onValueChange={(next) => {
            const v = next ?? "";
            setDraft(v);
            handleCommit(v);
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
          rows={6}
          placeholder={placeholder}
          disabled={pending}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => handleCommit(draft)}
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
        onBlur={() => handleCommit(draft)}
        className={inputClassName}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
