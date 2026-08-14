"use client";

import Link from "next/link";

import {
  BODY_AREA_LABEL,
  BODY_AREA_OPTIONS,
  STATUS_LABEL,
  STATUS_OPTIONS,
} from "@/components/symptoms/symptom-options";
import { TypeInlineField } from "@/components/symptoms/type-inline-field";
import type { Condition, SymptomType } from "@/db/schema";
import { formatAbsoluteDate } from "@/lib/datetime";

/*
 * Current section per §6.5 — status prominent, the rest in a compact grid. The
 * symptom-type analog of condition-current-section: status / body area / linked
 * condition / first noted, all inline-editable (no change log, so status is a
 * plain PATCH). Linked condition renders as a live link to its detail page.
 */

interface Props {
  patientId: string;
  type: SymptomType;
  linkedCondition: Condition | undefined;
  conditionOptions: ReadonlyArray<{ id: string; name: string }>;
}

const SECTION_HEAD =
  "mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground";
const FIELD_LABEL =
  "mb-1 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

export function TypeCurrentSection({
  patientId,
  type,
  linkedCondition,
  conditionOptions,
}: Props) {
  return (
    <section className="mb-8">
      <h2 className={SECTION_HEAD}>Current</h2>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted/40 px-4 py-3 md:grid-cols-4">
        <div>
          <div className={FIELD_LABEL}>status</div>
          <TypeInlineField
            fieldKey="status"
            value={type.status}
            variant="select"
            required
            clearable={false}
            ariaLabel="Status"
            options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            displayValue={
              <span className="text-sm">{STATUS_LABEL[type.status] ?? type.status}</span>
            }
          />
        </div>
        <div>
          <div className={FIELD_LABEL}>body area</div>
          <TypeInlineField
            fieldKey="bodyArea"
            value={type.bodyArea}
            variant="select"
            required={false}
            clearable
            ariaLabel="Body area"
            options={BODY_AREA_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            displayValue={
              <span className="text-sm">
                {type.bodyArea ? (
                  BODY_AREA_LABEL[type.bodyArea] ?? type.bodyArea
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>
            }
          />
        </div>
        <div>
          <div className={FIELD_LABEL}>first noted</div>
          <TypeInlineField
            fieldKey="firstNoted"
            value={type.firstNoted}
            variant="date"
            required={false}
            clearable
            ariaLabel="First noted"
            displayValue={
              <span className="text-sm">
                {type.firstNoted ? (
                  formatAbsoluteDate(type.firstNoted)
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>
            }
          />
        </div>
        <div>
          <div className={FIELD_LABEL}>linked condition</div>
          <TypeInlineField
            fieldKey="linkedCondition"
            value={type.linkedCondition}
            variant="select"
            required={false}
            clearable
            ariaLabel="Linked condition"
            // Populated → the condition link keeps the click (navigation
            // wins), the ✎ edits. Empty → the dash is the click-to-edit
            // target.
            displayIsInteractive={Boolean(type.linkedCondition)}
            options={conditionOptions.map((c) => ({ value: c.id, label: c.name }))}
            displayValue={
              <span className="text-sm">
                {linkedCondition ? (
                  <Link
                    href={`/patient/${patientId}/conditions/${linkedCondition.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    <span className="text-muted-foreground">§</span>{" "}
                    {linkedCondition.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>
            }
          />
        </div>
      </div>
    </section>
  );
}
