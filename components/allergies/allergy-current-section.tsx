"use client";

import Link from "next/link";

import {
  CATEGORY_OPTIONS,
  SEVERITY_OPTIONS,
  STATUS_OPTIONS,
} from "@/components/allergies/allergy-options";
import { AllergyInlineField } from "@/components/allergies/allergy-inline-field";
import { useMaybeAllergyLogChange } from "@/components/allergies/allergy-log-change-context";
import {
  LogChangeCard,
  LogChangeValue,
} from "@/components/log-change-affordance";
import type { Allergy, Doctor } from "@/db/schema";
import { formatAbsoluteDate } from "@/lib/datetime";
import { displayDoctorName } from "@/lib/doctor-display";
import { EntityTypeGlyph } from "@/components/entity-type-glyph";

interface Props {
  patientId: string;
  allergy: Allergy;
  confirmedByDoctor: Doctor | undefined;
  /** The patient's doctors, for the confirmedBy inline select. */
  doctorOptions: ReadonlyArray<{ id: string; name: string; specialty: string }>;
}

/*
 * Current section per design.md 6.5:1380 + Allergy emphasis (6.5:1402):
 * category + severity prominent (substance is the H1 — see header note);
 * reaction / status / first noted / confirmed by in the compact grid. Clones
 * condition-current-section.tsx.
 *
 * The severity card + the status grid value are click targets that open the
 * `+ Log a change` dialog preselected to their field (decisions.md
 * 2026-08-12); severity is clickable even at "Unknown" — the dialog is its
 * only write path.
 *
 * In edit mode:
 *   - status, severity stay read-only (change-logged — still route through
 *     `+ Log a change` on click)
 *   - category swaps to a select INSIDE its prominent card (PATCH-editable,
 *     unlike Condition's prominent fields, which are all change-logged)
 *   - reaction → text input; firstNoted → date input; confirmedBy → doctor
 *     select (server scope-checks the uuid)
 */

const SECTION_HEAD =
  "mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground";
const FIELD_LABEL =
  "mb-1 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
);
const SEVERITY_LABEL: Record<string, string> = Object.fromEntries(
  SEVERITY_OPTIONS.map((o) => [o.value, o.label]),
);
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
);

function DoctorValue({
  patientId,
  doctor,
}: {
  patientId: string;
  doctor: Doctor | undefined;
}) {
  if (!doctor) return <span className="text-muted-foreground">—</span>;
  return (
    <Link
      href={`/patient/${patientId}/doctors/${doctor.id}`}
      className="underline-offset-4 hover:underline"
    >
      <EntityTypeGlyph letter="D" />
      {displayDoctorName(doctor.name)} · {doctor.specialty}
    </Link>
  );
}

export function AllergyCurrentSection({
  patientId,
  allergy,
  confirmedByDoctor,
  doctorOptions,
}: Props) {
  const logChange = useMaybeAllergyLogChange();

  return (
    <section className="mb-8">
      <h2 className={SECTION_HEAD}>Current</h2>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-2xl font-semibold leading-tight">
            <AllergyInlineField
              fieldKey="category"
              value={allergy.category}
              variant="select-category"
              required
              clearable={false}
              ariaLabel="Category"
              displayValue={
                CATEGORY_LABEL[allergy.category] ?? allergy.category
              }
            />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">category</div>
        </div>
        <LogChangeCard
          onLogChange={logChange ? () => logChange.open("severity") : null}
          ariaLabel="Log a change to severity"
          className="rounded-lg border border-border bg-card p-4"
        >
          <div className="text-2xl font-semibold leading-tight">
            {allergy.severity ? (
              SEVERITY_LABEL[allergy.severity] ?? allergy.severity
            ) : (
              <span className="text-muted-foreground">Unknown</span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">severity</div>
        </LogChangeCard>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted/40 px-4 py-3 md:grid-cols-4">
        <div>
          <div className={FIELD_LABEL}>reaction</div>
          <AllergyInlineField
            fieldKey="reaction"
            value={allergy.reaction}
            variant="text"
            required={false}
            clearable
            ariaLabel="Reaction"
            placeholder="Hives, anaphylaxis…"
            displayValue={
              <span className="text-sm">
                {allergy.reaction ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>
            }
          />
        </div>
        <div>
          <div className={FIELD_LABEL}>status</div>
          <div className="text-sm">
            <LogChangeValue
              ariaLabel="Log a change to status"
              onLogChange={logChange ? () => logChange.open("status") : null}
            >
              {STATUS_LABEL[allergy.status] ?? allergy.status}
            </LogChangeValue>
          </div>
        </div>
        <div>
          <div className={FIELD_LABEL}>first noted</div>
          <AllergyInlineField
            fieldKey="firstNoted"
            value={allergy.firstNoted}
            variant="date"
            required={false}
            clearable
            ariaLabel="First noted"
            displayValue={
              <span className="text-sm">
                {allergy.firstNoted ? (
                  formatAbsoluteDate(allergy.firstNoted)
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>
            }
          />
        </div>
        <div>
          <div className={FIELD_LABEL}>confirmed by</div>
          <AllergyInlineField
            fieldKey="confirmedBy"
            value={allergy.confirmedBy}
            variant="select-doctor"
            required={false}
            clearable
            ariaLabel="Confirmed by"
            // Populated → the doctor link keeps the click (navigation
            // wins), the ✎ edits. Empty → the dash is the click-to-edit
            // target.
            displayIsInteractive={Boolean(allergy.confirmedBy)}
            options={doctorOptions.map((d) => ({
              value: d.id,
              label: `${displayDoctorName(d.name)} · ${d.specialty}`,
            }))}
            displayValue={
              <span className="text-sm">
                <DoctorValue patientId={patientId} doctor={confirmedByDoctor} />
              </span>
            }
          />
        </div>
      </div>
    </section>
  );
}
