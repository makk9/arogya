"use client";

import Link from "next/link";

import { InlineField } from "@/components/medications/inline-field";
import { useMaybeMedicationEdit } from "@/components/medications/medication-edit-context";
import { useMaybeMedicationLogChange } from "@/components/medications/medication-log-change-context";
import type { Condition, Doctor, Medication } from "@/db/schema";
import { formatAbsoluteDate } from "@/lib/datetime";
import { displayDoctorName } from "@/lib/doctor-display";
import { EntityTypeGlyph } from "@/components/entity-type-glyph";

export interface DoseInlineNote {
  oldValue: string;
  changedAt: Date;
}

interface Props {
  patientId: string;
  medication: Medication;
  prescribingDoctor: Doctor | undefined;
  treatsCondition: Condition | undefined;
  doseInlineNote: DoseInlineNote | null;
}

/*
 * Current section per design.md 6.5:1380. Prominent dose + frequency cards,
 * compact 4-column grid below for prescribing doctor / treats / form /
 * category.
 *
 * In edit mode:
 *   - dose, frequency, prescribingDoctor stay read-only (clinical fields —
 *     route through `+ Log a change`)
 *   - treats (purpose) stays read-only (Condition autocomplete is Phase D)
 *   - form + category swap to InlineField select variants
 *   - a single muted hint renders below the dose card explaining where to
 *     log clinical changes; the hint is a button that opens the log-change
 *     dialog via context
 */

const SECTION_HEAD =
  "mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground";
const FIELD_LABEL =
  "mb-1 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function MedicationCurrentSection({
  patientId,
  medication,
  prescribingDoctor,
  treatsCondition,
  doseInlineNote,
}: Props) {
  const editCtx = useMaybeMedicationEdit();
  const editing = editCtx?.editing ?? false;
  const logChange = useMaybeMedicationLogChange();

  return (
    <section className="mb-8">
      <h2 className={SECTION_HEAD}>Current</h2>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-2xl font-semibold leading-tight">
            {medication.currentDose}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">dose</div>
          {doseInlineNote ? (
            <div className="mt-2 text-xs text-muted-foreground">
              changed from {doseInlineNote.oldValue} on{" "}
              {formatAbsoluteDate(doseInlineNote.changedAt)}
            </div>
          ) : null}
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-2xl font-semibold leading-tight">
            {medication.currentFrequency}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">frequency</div>
        </div>
      </div>

      {editing && logChange ? (
        <button
          type="button"
          onClick={logChange.open}
          className="mt-2 text-left text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Use &quot;+ Log a change&quot; in History to update dose, frequency,
          status, or prescribing doctor.
        </button>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted/40 px-4 py-3 md:grid-cols-4">
        <div>
          <div className={FIELD_LABEL}>prescribing doctor</div>
          <div className="text-sm">
            {prescribingDoctor ? (
              // Live link now that the Doctor detail page exists (Phase D).
              <Link
                href={`/patient/${patientId}/doctors/${prescribingDoctor.id}`}
                className="underline-offset-4 hover:underline"
              >
                <EntityTypeGlyph letter="D" />
                {displayDoctorName(prescribingDoctor.name)} ·{" "}
                {prescribingDoctor.specialty}
              </Link>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </div>
        <div>
          <div className={FIELD_LABEL}>treats</div>
          <div className="text-sm">
            {treatsCondition ? (
              // Live link now that the Condition detail page exists (Phase D).
              // Keeps the `§` vault-reference glyph (not a letter badge) per
              // §6.5:1410.
              <Link
                href={`/patient/${patientId}/conditions/${treatsCondition.id}`}
                className="underline-offset-4 hover:underline"
              >
                <span className="text-muted-foreground">§</span>{" "}
                {treatsCondition.name}
              </Link>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </div>
        <div>
          <div className={FIELD_LABEL}>form</div>
          <InlineField
            fieldKey="form"
            value={medication.form ?? ""}
            variant="select-form"
            required={false}
            clearable
            ariaLabel="Form"
            displayValue={
              <span className="text-sm">
                {medication.form ? (
                  capitalize(medication.form)
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>
            }
          />
        </div>
        <div>
          <div className={FIELD_LABEL}>category</div>
          <InlineField
            fieldKey="category"
            value={medication.category}
            variant="select-category"
            required
            clearable={false}
            ariaLabel="Category"
            displayValue={<span className="text-sm">{medication.category}</span>}
          />
        </div>
      </div>
    </section>
  );
}
