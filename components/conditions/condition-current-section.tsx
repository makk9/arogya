"use client";

import {
  CATEGORY_OPTIONS,
  SEVERITY_OPTIONS,
  STATUS_OPTIONS,
} from "@/components/conditions/condition-options";
import { ConditionInlineField } from "@/components/conditions/condition-inline-field";
import { useMaybeConditionEdit } from "@/components/conditions/condition-edit-context";
import { useMaybeConditionLogChange } from "@/components/conditions/condition-log-change-context";
import type { Condition, Doctor } from "@/db/schema";
import { formatAbsoluteDate } from "@/lib/datetime";

interface Props {
  condition: Condition;
  managingDoctor: Doctor | undefined;
  diagnosedByDoctor: Doctor | undefined;
}

/*
 * Current section per design.md 6.5:1380 + Condition emphasis (6.5:1400):
 * status + severity prominent; category / diagnosed date / diagnosing doctor /
 * managing doctor in the compact grid. Clones medication-current-section.tsx.
 *
 * In edit mode:
 *   - status, severity, managingDoctor stay read-only (change-logged — route
 *     through `+ Log a change`)
 *   - diagnosedBy stays read-only (doctor picker lands with the Doctor entity)
 *   - category swaps to an InlineField select; diagnosedOn to a date input
 *   - a single muted hint renders below the cards explaining where to log
 *     clinical changes; the hint is a button that opens the log-change dialog.
 *
 * Status / severity pills are neutral semantic tokens (no color-coding) — the
 * brand accent is stone-only/deferred (7.2). The med detail header's hardcoded
 * emerald/amber pill colors are NOT reproduced here.
 */

const SECTION_HEAD =
  "mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground";
const FIELD_LABEL =
  "mb-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground";

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
);
const SEVERITY_LABEL: Record<string, string> = Object.fromEntries(
  SEVERITY_OPTIONS.map((o) => [o.value, o.label]),
);
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
);

function DoctorValue({ doctor }: { doctor: Doctor | undefined }) {
  if (!doctor) return <span className="text-muted-foreground">—</span>;
  return (
    <span>
      <span className="text-muted-foreground">D</span> Dr {doctor.name} ·{" "}
      {doctor.specialty}
    </span>
  );
}

export function ConditionCurrentSection({
  condition,
  managingDoctor,
  diagnosedByDoctor,
}: Props) {
  const editCtx = useMaybeConditionEdit();
  const editing = editCtx?.editing ?? false;
  const logChange = useMaybeConditionLogChange();

  return (
    <section className="mb-8">
      <h2 className={SECTION_HEAD}>Current</h2>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-2xl font-semibold leading-tight">
            {STATUS_LABEL[condition.status] ?? condition.status}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">status</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-2xl font-semibold leading-tight">
            {condition.severity ? (
              SEVERITY_LABEL[condition.severity] ?? condition.severity
            ) : (
              <span className="text-muted-foreground">Not assessed</span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">severity</div>
        </div>
      </div>

      {editing && logChange ? (
        <button
          type="button"
          onClick={logChange.open}
          className="mt-2 text-left text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Use &quot;+ Log a change&quot; in History to update status, severity,
          or managing doctor.
        </button>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted/40 px-4 py-3 md:grid-cols-4">
        <div>
          <div className={FIELD_LABEL}>category</div>
          <ConditionInlineField
            fieldKey="category"
            value={condition.category}
            variant="select-category"
            required={false}
            clearable
            ariaLabel="Category"
            displayValue={
              <span className="text-sm">
                {condition.category ? (
                  CATEGORY_LABEL[condition.category] ?? condition.category
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>
            }
          />
        </div>
        <div>
          <div className={FIELD_LABEL}>diagnosed on</div>
          <ConditionInlineField
            fieldKey="diagnosedOn"
            value={condition.diagnosedOn}
            variant="date"
            required={false}
            clearable
            ariaLabel="Diagnosed on"
            displayValue={
              <span className="text-sm">
                {condition.diagnosedOn ? (
                  formatAbsoluteDate(condition.diagnosedOn)
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>
            }
          />
        </div>
        <div>
          <div className={FIELD_LABEL}>diagnosed by</div>
          <div className="text-sm">
            <DoctorValue doctor={diagnosedByDoctor} />
          </div>
        </div>
        <div>
          <div className={FIELD_LABEL}>managing doctor</div>
          <div className="text-sm">
            <DoctorValue doctor={managingDoctor} />
          </div>
        </div>
      </div>
    </section>
  );
}
