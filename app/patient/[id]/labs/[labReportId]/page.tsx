import { notFound } from "next/navigation";
import { z } from "zod";

import { AskAiButton } from "@/components/ask-ai-button";
import { LabActionsMenu } from "@/components/labs/lab-actions-menu";
import { LabDetailHeader } from "@/components/labs/lab-detail-header";
import { LabDetailShell } from "@/components/labs/lab-detail-shell";
import { LabLinkedContextSection } from "@/components/labs/lab-linked-context-section";
import { LabMarkersSection } from "@/components/labs/lab-markers-section";
import { LabNotesSection } from "@/components/labs/lab-notes-section";
import { LabOutcomesSection } from "@/components/labs/lab-outcomes-section";
import { LabSummarySection } from "@/components/labs/lab-summary-section";
import { isCritical, isFlagged } from "@/components/labs/lab-options";
import { doctorQueries } from "@/db/queries/doctor";
import { labReportQueries, labResultQueries } from "@/db/queries/lab";
import { getCurrentPatient } from "@/lib/auth";
import { formatAbsoluteDate } from "@/lib/datetime";
import { displayDoctorName } from "@/lib/doctor-display";

/*
 * Lab report detail per the §6.7 event-detail template. Section order:
 * header → Summary (interpretation lead-in) → MARKERS (read-only table +
 * `+ Log a correction`) → Outcomes (flagged-marker count) → Linked context
 * (monitored conditions + previous panels) → Notes. No History section (events
 * have no change log). Sections omit themselves when empty.
 */

const reportIdParam = z.string().uuid();

export default async function LabReportDetailPage({
  params,
}: {
  params: Promise<{ id: string; labReportId: string }>;
}) {
  const { id, labReportId: rawId } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  const idCheck = reportIdParam.safeParse(rawId);
  if (!idCheck.success) notFound();
  const labReportId = idCheck.data;

  const report = await labReportQueries.getById(patient.patientId, labReportId);
  if (!report) notFound();

  const [results, doctors, monitoredConditions, previousPanels] =
    await Promise.all([
      labResultQueries.forReport(labReportId),
      doctorQueries.forPatient(patient.patientId),
      labReportQueries.monitoredConditions(patient.patientId, labReportId),
      labReportQueries.previousPanelsOfType(
        patient.patientId,
        report.reportType,
        report.reportDate,
        labReportId,
      ),
    ]);

  const orderingDoctor = report.orderedBy
    ? doctors.find((d) => d.id === report.orderedBy)
    : undefined;
  const doctorOptions = doctors.map((d) => ({
    value: d.id,
    label: `${displayDoctorName(d.name)} · ${d.specialty}`,
  }));

  const flaggedCount = results.filter((r) => isFlagged(r.flag)).length;
  const criticalCount = results.filter((r) => isCritical(r.flag)).length;

  const reportLabel = `${report.reportType ?? report.labName ?? "Lab report"} · ${formatAbsoluteDate(report.reportDate)}`;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <LabDetailShell report={report}>
        <LabDetailHeader
          patientId={patient.patientId}
          report={report}
          orderingDoctor={orderingDoctor}
          doctorOptions={doctorOptions}
          actionsSlot={
            <LabActionsMenu
              patientId={patient.patientId}
              reportId={report.id}
              reportLabel={reportLabel}
              markerCount={results.length}
            />
          }
        />

        <div className="mt-6">
          <LabSummarySection summary={report.summary?.trim() ?? ""} />
          <LabMarkersSection reportId={report.id} results={results} />
          <LabOutcomesSection
            flaggedCount={flaggedCount}
            criticalCount={criticalCount}
          />
          <LabLinkedContextSection
            patientId={patient.patientId}
            reportDate={report.reportDate}
            monitoredConditions={monitoredConditions}
            previousPanels={previousPanels}
          />
          <LabNotesSection notes={report.notes?.trim() ?? ""} />
        </div>
      </LabDetailShell>

      <AskAiButton surface={{ key: "lab-report", id: report.id }} />
    </main>
  );
}
