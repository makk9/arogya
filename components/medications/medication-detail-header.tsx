"use client";

import type { ReactNode } from "react";

import { useMaybeMedicationEdit } from "@/components/medications/medication-edit-context";
import { InlineField } from "@/components/medications/inline-field";
import { Breadcrumb } from "@/components/breadcrumb";
import { Button } from "@/components/ui/button";
import type { Medication } from "@/db/schema";
import { formatAbsoluteDate } from "@/lib/datetime";
import { cn } from "@/lib/utils";

interface Props {
  patientId: string;
  medication: Medication;
  // Slot for the `…` menu (or null when status === "discontinued").
  actionsSlot: ReactNode | null;
}

/*
 * Detail header per design.md §6.5 page shell — breadcrumb on top, then a
 * flex row with the H1 (or editable name/brand inputs) on the left and the
 * Edit/Done button + `…` menu on the right. In edit mode the subtitle is
 * replaced by InlineField pickers for form + startedOn.
 *
 * The Edit button is rendered here (not in the shell) so it visually anchors
 * to the H1 row per §6.5 rather than floating above the breadcrumb. State
 * comes from MedicationEditContext; the shell freezes editing=false for
 * discontinued meds so the button effectively disappears without each
 * component re-checking status.
 */

// Neutral semantic tokens regardless of status — the green/amber register the
// pill originally shipped with was the §7.2 anti-pattern (hardcoded color
// literals; clinical-status color-coding before the palette work). Fixed
// 2026-06-09 per the Phase D carryover; matches the Condition/Doctor headers.
const STATUS_PILL_CLASS = "border border-border bg-muted text-muted-foreground";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function MedicationDetailHeader({
  patientId,
  medication,
  actionsSlot,
}: Props) {
  const editCtx = useMaybeMedicationEdit();
  const editing = editCtx?.editing ?? false;
  const setEditing = editCtx?.setEditing ?? (() => {});

  // Edit button hidden on discontinued meds — shell freezes editing=false
  // and the Done branch is never reachable, so a static check on the
  // medication status is the clearest expression of intent here.
  const showEditButton = medication.status !== "discontinued";

  const subtitleParts: string[] = [];
  if (medication.form) subtitleParts.push(capitalize(medication.form));
  if (medication.startedOn) {
    subtitleParts.push(`started ${formatAbsoluteDate(medication.startedOn)}`);
  }

  const hasActionsRow = showEditButton || actionsSlot;

  return (
    <>
      <Breadcrumb patientId={patientId} trail={[{ label: "medications", href: "medications" }, { label: `${medication.id.slice(0, 8)}…` }]} />

      <div className="mb-2 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <InlineField
                  fieldKey="name"
                  value={medication.name}
                  variant="text"
                  required
                  clearable={false}
                  ariaLabel="Name"
                  displayValue={medication.name}
                />
                <InlineField
                  fieldKey="brandName"
                  value={medication.brandName}
                  variant="text"
                  required={false}
                  clearable
                  ariaLabel="Brand name"
                  placeholder="Brand name (optional)"
                  displayValue={medication.brandName ?? "—"}
                />
              </div>
              <span
                className={cn(
                  "inline-flex w-fit items-baseline rounded-full px-2 py-0.5 text-[0.7em] font-medium uppercase tracking-wide",
                  STATUS_PILL_CLASS,
                )}
              >
                {medication.status}
              </span>
            </div>
          ) : (
            <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-heading text-2xl font-semibold leading-tight">
              <span className="border-b-2 border-destructive pb-1">
                {medication.name}
              </span>
              {medication.brandName ? (
                <span className="text-base font-normal text-muted-foreground">
                  ({medication.brandName})
                </span>
              ) : null}
              <span
                className={cn(
                  "inline-flex items-baseline rounded-full px-2 py-0.5 text-[0.55em] font-medium uppercase tracking-wide",
                  STATUS_PILL_CLASS,
                )}
              >
                {medication.status}
              </span>
            </h1>
          )}
        </div>

        {hasActionsRow ? (
          <div className="flex shrink-0 items-center gap-2">
            {showEditButton ? (
              <Button
                type="button"
                variant={editing ? "default" : "outline"}
                size="sm"
                onClick={() => setEditing(!editing)}
              >
                {editing ? "Done" : "Edit"}
              </Button>
            ) : null}
            {actionsSlot}
          </div>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              form
            </div>
            <InlineField
              fieldKey="form"
              value={medication.form ?? ""}
              variant="select-form"
              required={false}
              clearable
              ariaLabel="Form"
              displayValue={
                medication.form ? capitalize(medication.form) : "—"
              }
            />
          </div>
          <div>
            <div className="mb-1 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              started on
            </div>
            <InlineField
              fieldKey="startedOn"
              value={medication.startedOn}
              variant="date"
              required={false}
              clearable
              ariaLabel="Started on"
              displayValue={
                medication.startedOn
                  ? formatAbsoluteDate(medication.startedOn)
                  : "—"
              }
            />
          </div>
        </div>
      ) : subtitleParts.length > 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {subtitleParts.join(" · ")}
        </p>
      ) : null}
    </>
  );
}
