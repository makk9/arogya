"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { NOT_SET } from "@/components/conditions/condition-options";
import { FLAG_SELECT_ITEMS } from "@/components/labs/lab-options";
import { NUMERIC_VALUE_RE } from "@/lib/schemas/forms/lab-report";
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
import type { LabResult } from "@/db/schema";
import { formatMarkerValue } from "@/components/labs/marker-display";

/*
 * §6.7 `+ Log a correction` — amends one already-stored marker. The dashed
 * affordance in the MARKERS section header opens this dialog; the user picks a
 * marker, edits the measured fields, and saves. PATCHes
 * /api/lab-reports/[id]/results/[resultId] (in-place overwrite — there is no
 * lab_results_changes table; decision flagged in decisions.md). Marker name is
 * immutable (it's the row's identity), so it isn't editable here.
 */

const NUMERIC_RE = NUMERIC_VALUE_RE;

const FIELD_LABEL_CLASS =
  "text-xs uppercase tracking-wide font-mono text-foreground";

interface Props {
  reportId: string;
  results: ReadonlyArray<LabResult>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Draft {
  value: string;
  unit: string;
  referenceLow: string;
  referenceHigh: string;
  flag: string;
}

function draftFromResult(r: LabResult): Draft {
  return {
    value: r.valueText ?? r.value ?? "",
    unit: r.unit ?? "",
    referenceLow: r.referenceLow ?? "",
    referenceHigh: r.referenceHigh ?? "",
    flag: r.flag ?? "",
  };
}

const flagItems = FLAG_SELECT_ITEMS;

export function LabCorrectionDialog({
  reportId,
  results,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectMarker = (id: string) => {
    const r = results.find((res) => res.id === id);
    setSelectedId(id);
    setDraft(r ? draftFromResult(r) : null);
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSelectedId(null);
      setDraft(null);
      setError(null);
    }
    onOpenChange(next);
  };

  const save = async () => {
    if (!selectedId || !draft) return;

    const lo = draft.referenceLow.trim();
    const hi = draft.referenceHigh.trim();
    if (lo !== "" && !NUMERIC_RE.test(lo)) {
      setError("Reference low must be a number.");
      return;
    }
    if (hi !== "" && !NUMERIC_RE.test(hi)) {
      setError("Reference high must be a number.");
      return;
    }

    // Split the single value input into numeric value / qualitative valueText.
    const raw = draft.value.trim();
    const body: Record<string, string | null> = {
      value: raw !== "" && NUMERIC_RE.test(raw) ? raw : null,
      valueText: raw !== "" && !NUMERIC_RE.test(raw) ? raw : null,
      unit: draft.unit.trim() || null,
      referenceLow: lo || null,
      referenceHigh: hi || null,
      flag: draft.flag || null,
    };

    setError(null);
    setPending(true);
    try {
      const res = await fetch(
        `/api/lab-reports/${reportId}/results/${selectedId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (res.ok) {
        router.refresh();
        handleOpenChange(false);
        return;
      }
      const parsed = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      setError(parsed.error?.message ?? "Couldn't save the correction.");
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setPending(false);
    }
  };

  const markerItems = results.map((r) => ({
    value: r.id,
    label: `${r.marker} · ${formatMarkerValue(r)}`,
  }));

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Log a correction</AlertDialogTitle>
          <AlertDialogDescription>
            Amend a marker that was entered wrong. This updates the value in
            place — the marker name stays as recorded.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS}>Marker</FieldLabel>
            <Select
              value={selectedId ?? null}
              items={markerItems}
              onValueChange={(v) => v && selectMarker(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick a marker to correct…" />
              </SelectTrigger>
              <SelectContent>
                {markerItems.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {draft ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel className={FIELD_LABEL_CLASS}>Value</FieldLabel>
                  <Input
                    value={draft.value}
                    autoComplete="off"
                    onChange={(e) =>
                      setDraft({ ...draft, value: e.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel className={FIELD_LABEL_CLASS}>Unit</FieldLabel>
                  <Input
                    value={draft.unit}
                    autoComplete="off"
                    onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field>
                  <FieldLabel className={FIELD_LABEL_CLASS}>Ref low</FieldLabel>
                  <Input
                    value={draft.referenceLow}
                    autoComplete="off"
                    onChange={(e) =>
                      setDraft({ ...draft, referenceLow: e.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel className={FIELD_LABEL_CLASS}>Ref high</FieldLabel>
                  <Input
                    value={draft.referenceHigh}
                    autoComplete="off"
                    onChange={(e) =>
                      setDraft({ ...draft, referenceHigh: e.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel className={FIELD_LABEL_CLASS}>Flag</FieldLabel>
                  <Select
                    value={draft.flag || NOT_SET}
                    items={flagItems}
                    onValueChange={(next) =>
                      setDraft({
                        ...draft,
                        flag: next === NOT_SET || !next ? "" : next,
                      })
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
            </>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            disabled={pending || !draft}
            onClick={() => void save()}
          >
            {pending ? "Saving…" : "Save correction"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
