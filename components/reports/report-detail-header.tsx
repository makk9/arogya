"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import {
  REPORT_TYPE_LABEL,
  REPORT_TYPE_OPTIONS,
} from "@/components/reports/report-options";
import { ReportInlineField } from "@/components/reports/report-inline-field";
import { useMaybeReportEdit } from "@/components/reports/report-edit-context";
import { Breadcrumb } from "@/components/breadcrumb";
import { Button } from "@/components/ui/button";
import type { Doctor, Report } from "@/db/schema";
import { formatAbsoluteDate } from "@/lib/datetime";
import { displayDoctorName } from "@/lib/doctor-display";

interface Props {
  patientId: string;
  report: Report;
  linkedDoctor: Doctor | undefined;
  doctorOptions: ReadonlyArray<{ value: string; label: string }>;
  visitOptions: ReadonlyArray<{ value: string; label: string }>;
  // Slot for the `…` menu.
  actionsSlot: ReactNode | null;
}

/*
 * Event detail header per design.md §6.7 page shell. Title is the report's own
 * title (the §6.7 "entry's title" shape, like Journal), with the report-type
 * pill beside it. Subtitle is the merged capture context — date issued + the
 * source doctor ("from Dr Sharma") per §4:491 "Author/source".
 *
 * Edit mode swaps the title/type into inline fields and exposes the date + both
 * linked FKs (doctor, visit) — the full event row is correctable in place
 * (§6.7: Edit corrects the row, no change log). Breadcrumb renders the §6.7 date
 * slug rather than the row uuid.
 */
export function ReportDetailHeader({
  patientId,
  report,
  linkedDoctor,
  doctorOptions,
  visitOptions,
  actionsSlot,
}: Props) {
  const editCtx = useMaybeReportEdit();
  const editing = editCtx?.editing ?? false;
  const setEditing = editCtx?.setEditing ?? (() => {});

  const typeLabel = report.reportType
    ? (REPORT_TYPE_LABEL[report.reportType] ?? report.reportType)
    : null;

  const subtitleParts: ReactNode[] = [formatAbsoluteDate(report.reportDate)];
  if (linkedDoctor) {
    subtitleParts.push(
      <>
        from{" "}
        <Link
          href={`/patient/${patientId}/doctors/${linkedDoctor.id}`}
          className="underline-offset-4 hover:underline"
        >
          {displayDoctorName(linkedDoctor.name)}
        </Link>
      </>,
    );
  }

  const typeItems = REPORT_TYPE_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
  }));

  return (
    <>
      <Breadcrumb patientId={patientId} trail={[{ label: "reports", href: "reports" }, { label: report.reportDate }]} />

      <div className="mb-2 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <ReportInlineField
                  fieldKey="title"
                  value={report.title}
                  variant="text"
                  required
                  clearable={false}
                  ariaLabel="Title"
                  placeholder="Document title…"
                  displayValue={null}
                />
                <ReportInlineField
                  fieldKey="reportType"
                  value={report.reportType}
                  variant="select"
                  required={false}
                  clearable
                  ariaLabel="Report type"
                  placeholder="Report type…"
                  options={typeItems}
                  displayValue={null}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <ReportInlineField
                  fieldKey="reportDate"
                  value={report.reportDate}
                  variant="date"
                  required
                  clearable={false}
                  ariaLabel="Date issued"
                  displayValue={null}
                />
                <ReportInlineField
                  fieldKey="linkedDoctorId"
                  value={report.linkedDoctorId}
                  variant="select"
                  required={false}
                  clearable
                  ariaLabel="Linked doctor"
                  placeholder="Linked doctor…"
                  options={doctorOptions}
                  displayValue={null}
                />
                <ReportInlineField
                  fieldKey="linkedVisitId"
                  value={report.linkedVisitId}
                  variant="select"
                  required={false}
                  clearable
                  ariaLabel="Linked visit"
                  placeholder="Linked visit…"
                  options={visitOptions}
                  displayValue={null}
                />
              </div>
            </div>
          ) : (
            <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-heading text-2xl font-semibold leading-tight">
              <span className="border-b-2 border-destructive pb-1">
                {report.title}
              </span>
              {typeLabel ? (
                <span className="inline-flex items-baseline rounded-full border border-border bg-muted px-2 py-0.5 text-[0.55em] font-medium uppercase tracking-wide text-muted-foreground">
                  {typeLabel}
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

      {!editing ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {subtitleParts.map((part, i) => (
            <span key={i}>
              {i > 0 ? " · " : null}
              {part}
            </span>
          ))}
        </p>
      ) : null}
    </>
  );
}
