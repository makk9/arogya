import type { Condition, Doctor, Medication } from "@/db/schema";
import { formatAbsoluteDate } from "@/lib/datetime";

export interface DoseInlineNote {
  oldValue: string;
  changedAt: Date;
}

interface Props {
  medication: Medication;
  prescribingDoctor: Doctor | undefined;
  treatsCondition: Condition | undefined;
  doseInlineNote: DoseInlineNote | null;
}

/*
 * Current section per design.md 6.5:1380. Two prominent equal-width cards
 * (dose + frequency, the medication-specific clinically-important fields)
 * over a tinted 4-column compact grid for secondary fields. Field-label
 * convention matches medication-form.tsx:88 (uppercase-mono, muted).
 */

const SECTION_HEAD =
  "mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground";
const FIELD_LABEL =
  "mb-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function MedicationCurrentSection({
  medication,
  prescribingDoctor,
  treatsCondition,
  doseInlineNote,
}: Props) {
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

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted/40 px-4 py-3 md:grid-cols-4">
        <div>
          <div className={FIELD_LABEL}>prescribing doctor</div>
          <div className="text-sm">
            {prescribingDoctor ? (
              <span>
                <span className="text-muted-foreground">D</span> Dr{" "}
                {prescribingDoctor.name} · {prescribingDoctor.specialty}
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </div>
        <div>
          <div className={FIELD_LABEL}>treats</div>
          <div className="text-sm">
            {treatsCondition ? (
              <span>
                <span className="text-muted-foreground">§</span>{" "}
                {treatsCondition.name}
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </div>
        <div>
          <div className={FIELD_LABEL}>form</div>
          <div className="text-sm">
            {medication.form ? (
              capitalize(medication.form)
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </div>
        <div>
          <div className={FIELD_LABEL}>category</div>
          <div className="text-sm">{medication.category}</div>
        </div>
      </div>
    </section>
  );
}
