"use client";

import type { ReactNode } from "react";

import { LabInlineField } from "@/components/labs/lab-inline-field";
import { useMaybeLabEdit } from "@/components/labs/lab-edit-context";
import { Button } from "@/components/ui/button";
import type { Doctor, LabReport } from "@/db/schema";
import { formatAbsoluteDate } from "@/lib/datetime";
import { displayDoctorName } from "@/lib/doctor-display";

interface Props {
  patientId: string;
  report: LabReport;
  orderingDoctor: Doctor | undefined;
  doctorOptions: ReadonlyArray<{ value: string; label: string }>;
  actionsSlot: ReactNode | null;
}

/*
 * Event detail header per design.md §6.7 page shell, lab shape. Title is the
 * report type (`Lipid panel`), falling back to lab name / "Lab report". §6.7's
 * separate "type pill" is folded into the title here — a `lipid panel` pill
 * beside a `Lipid panel` title would just duplicate (deviation noted in
 * decisions.md). The report date is the row's identity (breadcrumb slug +
 * subtitle), mirroring how the Visit title carries its date.
 *
 * Subtitle is the merged §6.7 capture context: lab name · ordering doctor ·
 * received date. Edit mode swaps report type / date / lab name / ordering
 * doctor into inline fields — the report row is correctable in place (the
 * MARKERS table stays read-only).
 */
export function LabDetailHeader({
  patientId,
  report,
  orderingDoctor,
  doctorOptions,
  actionsSlot,
}: Props) {
  const editCtx = useMaybeLabEdit();
  const editing = editCtx?.editing ?? false;
  const setEditing = editCtx?.setEditing ?? (() => {});

  const title = report.reportType ?? report.labName ?? "Lab report";

  const subtitleParts: string[] = [];
  // Only show lab name in the subtitle when it isn't already the title.
  if (report.labName && report.reportType) subtitleParts.push(report.labName);
  if (orderingDoctor) {
    subtitleParts.push(`ordered by ${displayDoctorName(orderingDoctor.name)}`);
  }
  subtitleParts.push(`received ${formatAbsoluteDate(report.reportDate)}`);

  return (
    <>
      <nav
        aria-label="breadcrumb"
        className="mb-6 font-mono text-xs text-muted-foreground"
      >
        / patient / {patientId.slice(0, 8)}… / labs / {report.reportDate}
      </nav>

      <div className="mb-2 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <LabInlineField
                  fieldKey="reportType"
                  value={report.reportType}
                  variant="text"
                  required={false}
                  clearable
                  ariaLabel="Report type"
                  placeholder="Lipid panel, CBC…"
                  displayValue={null}
                />
                <LabInlineField
                  fieldKey="reportDate"
                  value={report.reportDate}
                  variant="date"
                  required
                  clearable={false}
                  ariaLabel="Date received"
                  displayValue={null}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <LabInlineField
                  fieldKey="labName"
                  value={report.labName}
                  variant="text"
                  required={false}
                  clearable
                  ariaLabel="Lab name"
                  placeholder="Apollo Lab, Thyrocare…"
                  displayValue={null}
                />
                <LabInlineField
                  fieldKey="orderedBy"
                  value={report.orderedBy}
                  variant="select"
                  required={false}
                  clearable
                  ariaLabel="Ordering doctor"
                  placeholder="Ordering doctor…"
                  options={doctorOptions}
                  displayValue={null}
                />
              </div>
            </div>
          ) : (
            <h1 className="font-heading text-2xl font-semibold leading-tight">
              <span className="border-b-2 border-destructive pb-1">{title}</span>
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

      {!editing ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {subtitleParts.join(" · ")}
        </p>
      ) : null}
    </>
  );
}
