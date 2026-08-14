"use client";

import Link from "next/link";

import { InlineField } from "@/components/medications/inline-field";
import {
  LogChangeCard,
  LogChangeValue,
  ValueEditAction,
} from "@/components/log-change-affordance";
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
  /** The patient's conditions, for the treats (purpose) inline select. */
  conditionOptions: ReadonlyArray<{ value: string; label: string }>;
  doseInlineNote: DoseInlineNote | null;
}

/*
 * Current section per design.md 6.5:1380. Prominent dose + frequency cards,
 * compact 4-column grid below for prescribing doctor / treats / form /
 * category.
 *
 * The dose + frequency cards are click targets that open the `+ Log a change`
 * dialog preselected to their field (decisions.md 2026-08-12) — inert when the
 * shell omits the log-change provider (discontinued meds). Prescribing doctor
 * stays a nav link (navigation wins over the log-change affordance); its
 * change path is the dialog's own selector or the History button.
 *
 * In edit mode:
 *   - dose, frequency, prescribingDoctor stay read-only (clinical fields —
 *     the cards still route through `+ Log a change` on click)
 *   - treats (purpose) is a condition select (the Phase D "autocomplete
 *     pending" deferral is closed — conditions exist; a select over them
 *     replaces the imagined autocomplete)
 *   - form + category swap to InlineField select variants
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
  conditionOptions,
  doseInlineNote,
}: Props) {
  const logChange = useMaybeMedicationLogChange();

  return (
    <section className="mb-8">
      <h2 className={SECTION_HEAD}>Current</h2>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <LogChangeCard
          onLogChange={logChange ? () => logChange.open("dose") : null}
          ariaLabel="Log a change to dose"
          className="rounded-lg border border-border bg-card p-4"
        >
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
        </LogChangeCard>
        <LogChangeCard
          onLogChange={logChange ? () => logChange.open("frequency") : null}
          ariaLabel="Log a change to frequency"
          className="rounded-lg border border-border bg-card p-4"
        >
          <div className="text-2xl font-semibold leading-tight">
            {medication.currentFrequency}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">frequency</div>
        </LogChangeCard>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted/40 px-4 py-3 md:grid-cols-4">
        <div>
          <div className={FIELD_LABEL}>prescribing doctor</div>
          <div className="text-sm">
            {prescribingDoctor ? (
              // Live link now that the Doctor detail page exists (Phase D);
              // the ✎ routes changes to the log-change dialog.
              <ValueEditAction
                onAction={
                  logChange ? () => logChange.open("prescribing_doctor") : null
                }
                ariaLabel="Log a change to prescribing doctor"
                title="Log a change"
              >
                <Link
                  href={`/patient/${patientId}/doctors/${prescribingDoctor.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  <EntityTypeGlyph letter="D" />
                  {displayDoctorName(prescribingDoctor.name)} ·{" "}
                  {prescribingDoctor.specialty}
                </Link>
              </ValueEditAction>
            ) : (
              // No link to conflict with while unset — the empty value is a
              // log-change target so first assignment doesn't require finding
              // the History button.
              <LogChangeValue
                ariaLabel="Log a change to prescribing doctor"
                onLogChange={
                  logChange ? () => logChange.open("prescribing_doctor") : null
                }
              >
                <span className="text-muted-foreground">—</span>
              </LogChangeValue>
            )}
          </div>
        </div>
        <div>
          <div className={FIELD_LABEL}>treats</div>
          <InlineField
            fieldKey="purpose"
            value={medication.purpose}
            variant="select-condition"
            required={false}
            clearable
            ariaLabel="Treats"
            options={conditionOptions}
            // Populated → the condition link keeps the click (navigation
            // wins), the ✎ edits. Empty → the dash is the click-to-edit
            // target.
            displayIsInteractive={Boolean(medication.purpose)}
            displayValue={
              <span className="text-sm">
                {treatsCondition ? (
                  // Live link now that the Condition detail page exists
                  // (Phase D). Keeps the `§` vault-reference glyph (not a
                  // letter badge) per §6.5:1410.
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
              </span>
            }
          />
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
