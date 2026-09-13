"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { NOT_SET } from "@/components/conditions/condition-options";
import {
  CONTEXT_OPTIONS,
  FLAG_OPTIONS,
  READING_TYPE_LABEL,
  TWO_VALUE_TYPES,
} from "@/components/vitals/vital-options";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/*
 * Row-level correction for the vitals history table (decisions.md 2026-09-13 —
 * readings are now correctable in place, superseding §4:433). Mirrors the lab
 * marker `Log a correction` dialog: overwrite, no change log. The reading type
 * is the row's identity, so it's shown but not editable.
 */

const NUMERIC_RE = /^-?\d+(\.\d+)?$/;

const FIELD_LABEL_CLASS =
  "text-xs uppercase tracking-wide font-mono text-foreground";

export interface EditableVitalReading {
  id: string;
  readingType: string;
  recordedAt: string; // ISO
  valuePrimary: string | null;
  valueSecondary: string | null;
  unit: string;
  context: string | null;
  flag: string | null;
  notes: string | null;
}

interface Draft {
  recordedAtLocal: string;
  valuePrimary: string;
  valueSecondary: string;
  unit: string;
  context: string;
  flag: string;
  notes: string;
}

// Stored ISO → datetime-local input value ("YYYY-MM-DDTHH:mm", browser tz).
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function draftFrom(r: EditableVitalReading): Draft {
  return {
    recordedAtLocal: toDatetimeLocal(r.recordedAt),
    valuePrimary: r.valuePrimary ?? "",
    valueSecondary: r.valueSecondary ?? "",
    unit: r.unit,
    context: r.context ?? "",
    flag: r.flag ?? "",
    notes: r.notes ?? "",
  };
}

const contextItems = [
  { value: NOT_SET, label: "—" },
  ...CONTEXT_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
];
const flagItems = [
  { value: NOT_SET, label: "—" },
  ...FLAG_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
];

export function VitalEditButton({ reading }: { reading: EditableVitalReading }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(reading));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const twoValue = TWO_VALUE_TYPES.has(reading.readingType);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      // Re-seed from the current row each open — the page may have refreshed.
      setDraft(draftFrom(reading));
      setError(null);
    }
    setOpen(next);
  };

  const save = async () => {
    const primary = draft.valuePrimary.trim();
    const secondary = draft.valueSecondary.trim();
    const unit = draft.unit.trim();
    if (!draft.recordedAtLocal) return setError("When was it taken? Add a date and time.");
    if (!NUMERIC_RE.test(primary)) return setError("The reading needs a number.");
    if (twoValue && secondary !== "" && !NUMERIC_RE.test(secondary)) {
      return setError("The second value must be a number.");
    }
    if (!unit) return setError("Add a unit.");
    const recordedAt = new Date(draft.recordedAtLocal);
    if (Number.isNaN(recordedAt.getTime())) return setError("That date and time isn't valid.");

    const body: Record<string, string | null> = {
      recordedAt: recordedAt.toISOString(),
      valuePrimary: primary,
      unit,
      context: draft.context || null,
      flag: draft.flag || null,
      notes: draft.notes.trim() || null,
    };
    if (twoValue) body.valueSecondary = secondary || null;

    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/vital-readings/${reading.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
        return;
      }
      const parsed = (await res.json().catch(() => ({}))) as {
        error?: {
          message?: string;
          details?: { fieldErrors?: Record<string, string[]> };
        };
      };
      const fieldMsg = Object.values(parsed.error?.details?.fieldErrors ?? {})[0]?.[0];
      setError(fieldMsg ?? parsed.error?.message ?? "Couldn't save the correction.");
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        className="text-xs text-link underline-offset-4 hover:underline"
        aria-label={`Edit ${READING_TYPE_LABEL[reading.readingType] ?? "reading"}`}
      >
        Edit
      </button>
      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Edit {READING_TYPE_LABEL[reading.readingType]?.toLowerCase() ?? "reading"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Correct a reading that was entered wrong. This updates it in place.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel className={FIELD_LABEL_CLASS}>Taken at</FieldLabel>
              <Input
                type="datetime-local"
                value={draft.recordedAtLocal}
                onChange={(e) => setDraft({ ...draft, recordedAtLocal: e.target.value })}
              />
            </Field>
            <div className={twoValue ? "grid grid-cols-3 gap-3" : "grid grid-cols-2 gap-3"}>
              <Field>
                <FieldLabel className={FIELD_LABEL_CLASS}>
                  {twoValue ? "Systolic" : "Value"}
                </FieldLabel>
                <Input
                  value={draft.valuePrimary}
                  inputMode="decimal"
                  autoComplete="off"
                  onChange={(e) => setDraft({ ...draft, valuePrimary: e.target.value })}
                />
              </Field>
              {twoValue ? (
                <Field>
                  <FieldLabel className={FIELD_LABEL_CLASS}>Diastolic</FieldLabel>
                  <Input
                    value={draft.valueSecondary}
                    inputMode="decimal"
                    autoComplete="off"
                    onChange={(e) => setDraft({ ...draft, valueSecondary: e.target.value })}
                  />
                </Field>
              ) : null}
              <Field>
                <FieldLabel className={FIELD_LABEL_CLASS}>Unit</FieldLabel>
                <Input
                  value={draft.unit}
                  autoComplete="off"
                  onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel className={FIELD_LABEL_CLASS}>Context</FieldLabel>
                <Select
                  value={draft.context || NOT_SET}
                  items={contextItems}
                  onValueChange={(next) =>
                    setDraft({ ...draft, context: next === NOT_SET || !next ? "" : next })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Context…" />
                  </SelectTrigger>
                  <SelectContent>
                    {contextItems.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel className={FIELD_LABEL_CLASS}>Flag</FieldLabel>
                <Select
                  value={draft.flag || NOT_SET}
                  items={flagItems}
                  onValueChange={(next) =>
                    setDraft({ ...draft, flag: next === NOT_SET || !next ? "" : next })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Flag…" />
                  </SelectTrigger>
                  <SelectContent>
                    {flagItems.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel className={FIELD_LABEL_CLASS}>Notes</FieldLabel>
              <Textarea
                value={draft.notes}
                rows={2}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </Field>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button type="button" disabled={pending} onClick={() => void save()}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
