"use client";

import { DoctorInlineField } from "@/components/doctors/doctor-inline-field";
import { useMaybeDoctorEdit } from "@/components/doctors/doctor-edit-context";
import { useMaybeDoctorLogChange } from "@/components/doctors/doctor-log-change-context";
import type { Doctor } from "@/db/schema";
import {
  formatAbsoluteDate,
  formatDurationSince,
  formatRelativeDate,
} from "@/lib/datetime";
import { doctorInitials, maskPhone } from "@/lib/doctor-display";

interface Props {
  doctor: Doctor;
  /** YYYY-MM-DD of the most recent linked visit; null when none on file. */
  lastVisit: string | null;
}

/*
 * Current section per design.md 6.5:1380 + Doctor emphasis (6.5:1401): the
 * avatar sits *in the prominent card* alongside the specialty (it's part of
 * the doctor's identity, not a thumbnail); the compact grid below shows
 * clinic / phone / first visit (with duration for long-running relationships)
 * / last visit (derived from Visits, never stored). Email + address get a
 * second grid row — they're not in §6.5's four named grid fields, but the
 * schema carries them and this is their only edit surface (flagged deviation).
 *
 * In edit mode:
 *   - specialty + clinic stay read-only (change-logged — route through
 *     `+ Log a change`; decisions.md 2026-06-09)
 *   - last visit stays read-only (derived)
 *   - phone / email / address swap to InlineFields; firstVisit to a date input
 *   - a single muted hint below the card explains where to log the change-
 *     logged fields; the hint is a button that opens the log-change dialog.
 *
 * Phone renders masked at rest per §6.5:1414; the inline-edit input shows the
 * raw value (you can't correct what you can't see).
 */

const SECTION_HEAD =
  "mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground";
const FIELD_LABEL =
  "mb-1 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

export function DoctorCurrentSection({ doctor, lastVisit }: Props) {
  const editCtx = useMaybeDoctorEdit();
  const editing = editCtx?.editing ?? false;
  const logChange = useMaybeDoctorLogChange();

  const firstVisitDuration = doctor.firstVisit
    ? formatDurationSince(doctor.firstVisit)
    : null;

  const lastVisitParts: string[] = [];
  if (lastVisit) {
    lastVisitParts.push(formatRelativeDate(lastVisit));
    lastVisitParts.push(formatAbsoluteDate(lastVisit));
  }

  return (
    <section className="mb-8">
      <h2 className={SECTION_HEAD}>Current</h2>

      <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-base font-medium text-muted-foreground"
        >
          {doctorInitials(doctor.name)}
        </span>
        <div>
          <div className="text-2xl font-semibold leading-tight">
            {doctor.specialty}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">specialty</div>
        </div>
      </div>

      {editing && logChange ? (
        <button
          type="button"
          onClick={logChange.open}
          className="mt-2 text-left text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Use &quot;+ Log a change&quot; in History to update specialty or
          clinic.
        </button>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted/40 px-4 py-3 md:grid-cols-4">
        <div>
          <div className={FIELD_LABEL}>clinic</div>
          <div className="text-sm">{doctor.clinic ?? <Dash />}</div>
        </div>
        <div>
          <div className={FIELD_LABEL}>phone</div>
          <DoctorInlineField
            fieldKey="phone"
            value={doctor.phone}
            variant="text"
            required={false}
            clearable
            ariaLabel="Phone"
            displayValue={
              <span className="text-sm">
                {doctor.phone ? maskPhone(doctor.phone) : <Dash />}
              </span>
            }
          />
        </div>
        <div>
          <div className={FIELD_LABEL}>first visit</div>
          <DoctorInlineField
            fieldKey="firstVisit"
            value={doctor.firstVisit}
            variant="date"
            required={false}
            clearable
            ariaLabel="First visit"
            displayValue={
              <span className="text-sm">
                {doctor.firstVisit ? (
                  <>
                    {formatAbsoluteDate(doctor.firstVisit)}
                    {firstVisitDuration ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {firstVisitDuration}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <Dash />
                )}
              </span>
            }
          />
        </div>
        <div>
          <div className={FIELD_LABEL}>last visit</div>
          <div className="text-sm">
            {lastVisitParts.length > 0 ? (
              <>
                {lastVisitParts[0]}
                <span className="text-muted-foreground">
                  {" "}
                  · {lastVisitParts[1]}
                </span>
              </>
            ) : (
              <Dash />
            )}
          </div>
        </div>
        <div className="md:col-span-2">
          <div className={FIELD_LABEL}>email</div>
          <DoctorInlineField
            fieldKey="email"
            value={doctor.email}
            variant="text"
            required={false}
            clearable
            ariaLabel="Email"
            displayValue={
              <span className="text-sm">{doctor.email ?? <Dash />}</span>
            }
          />
        </div>
        <div className="md:col-span-2">
          <div className={FIELD_LABEL}>address</div>
          <DoctorInlineField
            fieldKey="address"
            value={doctor.address}
            variant="text"
            required={false}
            clearable
            ariaLabel="Address"
            displayValue={
              <span className="text-sm">{doctor.address ?? <Dash />}</span>
            }
          />
        </div>
      </div>
    </section>
  );
}
