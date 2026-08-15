import { notFound } from "next/navigation";
import { z } from "zod";

import { AskAiButton } from "@/components/ask-ai-button";
import { ReportActionsMenu } from "@/components/reports/report-actions-menu";
import { ReportBodySection } from "@/components/reports/report-body-section";
import { ReportDetailHeader } from "@/components/reports/report-detail-header";
import { ReportDetailShell } from "@/components/reports/report-detail-shell";
import { ReportLinkedContextSection } from "@/components/reports/report-linked-context-section";
import { ReportNotesSection } from "@/components/reports/report-notes-section";
import { ReportOutcomesSection } from "@/components/reports/report-outcomes-section";
import { doctorQueries } from "@/db/queries/doctor";
import { reportQueries } from "@/db/queries/report";
import { visitQueries } from "@/db/queries/visit";
import { getCurrentPatient } from "@/lib/auth";
import { formatAbsoluteDate } from "@/lib/datetime";
import { displayDoctorName } from "@/lib/doctor-display";

/*
 * Report detail per the §6.7 event-detail template. Section order: body (REPORT
 * CONTENT) → Outcomes → Linked context → Notes. No History section (events have
 * no change log); Outcomes renders the source_report_id backlinks (meds /
 * conditions extracted from the document); Linked context carries the linked
 * visit. Outcomes / Linked context / Notes are omitted when empty.
 */

const reportIdParam = z.string().uuid();

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string; reportId: string }>;
}) {
  const { id, reportId: rawReportId } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  const idCheck = reportIdParam.safeParse(rawReportId);
  if (!idCheck.success) notFound();
  const reportId = idCheck.data;

  const [report, outcomes, doctors, visits] = await Promise.all([
    reportQueries.getById(patient.patientId, reportId),
    reportQueries.outcomesForReport(patient.patientId, reportId),
    doctorQueries.forPatient(patient.patientId),
    visitQueries.forPatient(patient.patientId),
  ]);

  if (!report) notFound();

  const doctorMap = new Map(doctors.map((d) => [d.id, d]));
  const linkedDoctor = report.linkedDoctorId
    ? doctorMap.get(report.linkedDoctorId)
    : undefined;
  const linkedVisit = report.linkedVisitId
    ? (visits.find((v) => v.id === report.linkedVisitId) ?? null)
    : null;
  const linkedVisitDoctor = linkedVisit
    ? doctorMap.get(linkedVisit.doctorId)
    : undefined;

  const doctorOptions = doctors.map((d) => ({
    value: d.id,
    label: `${displayDoctorName(d.name)} · ${d.specialty}`,
  }));
  const visitOptions = visits.map((v) => {
    const d = doctorMap.get(v.doctorId);
    const who = d ? displayDoctorName(d.name) : "Visit";
    return {
      value: v.id,
      label: `${who} · ${formatAbsoluteDate(v.visitDate)}`,
    };
  });

  const outcomeCount = outcomes.medications.length + outcomes.conditions.length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <ReportDetailShell report={report}>
        <ReportDetailHeader
          patientId={patient.patientId}
          report={report}
          linkedDoctor={linkedDoctor}
          doctorOptions={doctorOptions}
          visitOptions={visitOptions}
          actionsSlot={
            <ReportActionsMenu
              patientId={patient.patientId}
              reportId={report.id}
              reportLabel={report.title}
              outcomeCount={outcomeCount}
            />
          }
        />

        <div className="mt-6">
          <ReportBodySection report={report} />
        </div>

        <ReportOutcomesSection
          patientId={patient.patientId}
          outcomes={outcomes}
        />

        <ReportLinkedContextSection
          patientId={patient.patientId}
          linkedVisit={linkedVisit}
          linkedVisitDoctorName={
            linkedVisitDoctor ? displayDoctorName(linkedVisitDoctor.name) : null
          }
        />

        <ReportNotesSection notes={report.notes?.trim() ?? ""} />
      </ReportDetailShell>

      <AskAiButton surface={{ key: "report", id: report.id }} />
    </main>
  );
}
