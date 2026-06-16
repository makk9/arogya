"use client";

import type { ReactNode } from "react";

import {
  STATUS_LABEL,
  STATUS_OPTIONS,
  VISIT_TYPE_LABEL,
  VISIT_TYPE_OPTIONS,
} from "@/components/visits/visit-options";
import { VisitInlineField } from "@/components/visits/visit-inline-field";
import { useMaybeVisitEdit } from "@/components/visits/visit-edit-context";
import { Button } from "@/components/ui/button";
import type { Doctor, Visit } from "@/db/schema";
import { formatAbsoluteDate } from "@/lib/datetime";
import { displayDoctorName } from "@/lib/doctor-display";

interface Props {
  patientId: string;
  visit: Visit;
  doctor: Doctor | undefined;
  doctorOptions: ReadonlyArray<{ value: string; label: string }>;
  // Slot for the `…` menu.
  actionsSlot: ReactNode | null;
}

/*
 * Event detail header per design.md §6.7 page shell. Title carries the §6.7
 * Visit shape — `Visit · Dr Sharma · Apr 3 2026` — with the visit-type pill
 * beside it and a status pill when not completed. Subtitle is the merged
 * capture context (clinic · visit type; the spec also lists duration, which
 * has no Phase 4 column — flagged in decisions.md). Breadcrumb renders the
 * §6.7 date slug rather than the row uuid.
 *
 * Edit mode swaps the title's doctor/date and the context row's type/status
 * into inline fields — the full event row is correctable in place.
 */
export function VisitDetailHeader({
  patientId,
  visit,
  doctor,
  doctorOptions,
  actionsSlot,
}: Props) {
  const editCtx = useMaybeVisitEdit();
  const editing = editCtx?.editing ?? false;
  const setEditing = editCtx?.setEditing ?? (() => {});

  const typeLabel = visit.visitType
    ? (VISIT_TYPE_LABEL[visit.visitType] ?? visit.visitType)
    : null;

  const subtitleParts: string[] = [];
  if (doctor?.clinic) subtitleParts.push(doctor.clinic);
  if (typeLabel) subtitleParts.push(typeLabel);

  const typeItems = VISIT_TYPE_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
  }));
  const statusItems = STATUS_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
  }));

  return (
    <>
      <nav
        aria-label="breadcrumb"
        className="mb-6 font-mono text-xs text-muted-foreground"
      >
        / patient / {patientId.slice(0, 8)}… / visits / {visit.visitDate}
      </nav>

      <div className="mb-2 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <VisitInlineField
                  fieldKey="doctorId"
                  value={visit.doctorId}
                  variant="select"
                  required
                  clearable={false}
                  ariaLabel="Doctor"
                  options={doctorOptions}
                  displayValue={null}
                />
                <VisitInlineField
                  fieldKey="visitDate"
                  value={visit.visitDate}
                  variant="date"
                  required
                  clearable={false}
                  ariaLabel="Visit date"
                  displayValue={null}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <VisitInlineField
                  fieldKey="visitType"
                  value={visit.visitType}
                  variant="select"
                  required={false}
                  clearable
                  ariaLabel="Visit type"
                  placeholder="Visit type…"
                  options={typeItems}
                  displayValue={null}
                />
                <VisitInlineField
                  fieldKey="status"
                  value={visit.status}
                  variant="select"
                  required
                  clearable={false}
                  ariaLabel="Status"
                  options={statusItems}
                  displayValue={null}
                />
              </div>
            </div>
          ) : (
            <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-heading text-2xl font-semibold leading-tight">
              <span className="border-b-2 border-destructive pb-1">
                Visit · {doctor ? displayDoctorName(doctor.name) : "—"} ·{" "}
                {formatAbsoluteDate(visit.visitDate)}
              </span>
              {typeLabel ? (
                <span className="inline-flex items-baseline rounded-full border border-border bg-muted px-2 py-0.5 text-[0.55em] font-medium uppercase tracking-wide text-muted-foreground">
                  {typeLabel}
                </span>
              ) : null}
              {visit.status !== "completed" ? (
                <span className="inline-flex items-baseline rounded-full border border-border bg-muted px-2 py-0.5 text-[0.55em] font-medium uppercase tracking-wide text-muted-foreground">
                  {STATUS_LABEL[visit.status] ?? visit.status}
                </span>
              ) : null}
            </h1>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant={editing ? "default" : "outline"}
            size="sm"
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Done" : "Edit"}
          </Button>
          {actionsSlot}
        </div>
      </div>

      {!editing && subtitleParts.length > 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {subtitleParts.join(" · ")}
        </p>
      ) : null}
    </>
  );
}
