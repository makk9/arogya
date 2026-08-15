import { notFound } from "next/navigation";
import { z } from "zod";

import { AskAiButton } from "@/components/ask-ai-button";
import { DoctorActionsMenu } from "@/components/doctors/doctor-actions-menu";
import { DoctorBriefButton } from "@/components/doctors/doctor-brief-button";
import { DoctorChangeEntry } from "@/components/doctors/doctor-change-entry";
import { DoctorCurrentSection } from "@/components/doctors/doctor-current-section";
import { DoctorDetailHeader } from "@/components/doctors/doctor-detail-header";
import { DoctorDetailShell } from "@/components/doctors/doctor-detail-shell";
import { DoctorHistorySection } from "@/components/doctors/doctor-history-section";
import {
  DoctorLinkedContext,
  type LinkedConditionRef,
  type LinkedLabOrderRef,
  type LinkedMedRef,
  type LinkedVisitRef,
} from "@/components/doctors/doctor-linked-context";
import { DoctorNotesSection } from "@/components/doctors/doctor-notes-section";
import { conditionQueries } from "@/db/queries/condition";
import { doctorChangeQueries, doctorQueries } from "@/db/queries/doctor";
import { labReportQueries } from "@/db/queries/lab";
import { medicationQueries } from "@/db/queries/medication";
import { visitQueries } from "@/db/queries/visit";
import { getCurrentPatient } from "@/lib/auth";

const doctorIdParam = z.string().uuid();
const RECENT_LIMIT = 5;

export default async function DoctorDetailPage({
  params,
}: {
  params: Promise<{ id: string; doctorId: string }>;
}) {
  const { id, doctorId: rawDoctorId } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  const idCheck = doctorIdParam.safeParse(rawDoctorId);
  if (!idCheck.success) notFound();
  const doctorId = idCheck.data;

  const [doctor, changes, medications, conditions, labReports, visits] =
    await Promise.all([
      doctorQueries.getById(patient.patientId, doctorId),
      doctorChangeQueries.forDoctor(patient.patientId, doctorId),
      medicationQueries.forPatient(patient.patientId),
      conditionQueries.forPatient(patient.patientId),
      labReportQueries.forPatient(patient.patientId),
      visitQueries.forPatient(patient.patientId),
    ]);

  if (!doctor) notFound();

  // Backlinks per §6.5 Doctor emphasis — FKs pointing AT this doctor, derived
  // at render time (Phase 3 tripwire: never stored).
  const linkedMeds: LinkedMedRef[] = medications
    .filter((m) => m.prescribingDoctor === doctorId)
    .map((m) => ({
      id: m.id,
      name: m.name,
      currentDose: m.currentDose,
      status: m.status,
    }));
  const linkedConditions: LinkedConditionRef[] = conditions
    .filter((c) => c.managingDoctor === doctorId)
    .map((c) => ({ id: c.id, name: c.name, status: c.status }));
  const linkedLabOrders: LinkedLabOrderRef[] = labReports
    .filter((r) => r.orderedBy === doctorId)
    .map((r) => ({
      id: r.id,
      reportDate: r.reportDate,
      labName: r.labName,
      reportType: r.reportType,
    }));
  const doctorVisits = visits.filter((v) => v.doctorId === doctorId);
  const linkedVisits: LinkedVisitRef[] = doctorVisits.map((v) => ({
    id: v.id,
    visitDate: v.visitDate,
    visitType: v.visitType,
  }));

  // Derived last visit (Phase 4: never stored). visitQueries returns the
  // patient's visits; the max visit_date among this doctor's is the answer.
  const lastVisit = doctorVisits.reduce<string | null>(
    (latest, v) => (latest === null || v.visitDate > latest ? v.visitDate : latest),
    null,
  );

  const hasLinks =
    linkedMeds.length > 0 ||
    linkedConditions.length > 0 ||
    linkedLabOrders.length > 0 ||
    linkedVisits.length > 0;

  // Pre-render entry arrays server-side; the History island just toggles
  // visibility. Collapse only when total > RECENT_LIMIT.
  const totalCount = changes.length;
  const recentEntries = changes
    .slice(0, RECENT_LIMIT)
    .map((c) => <DoctorChangeEntry key={c.id} change={c} />);
  const olderEntries =
    totalCount > RECENT_LIMIT
      ? changes
          .slice(RECENT_LIMIT)
          .map((c) => <DoctorChangeEntry key={c.id} change={c} />)
      : null;

  const notesText = doctor.notes?.trim() ?? "";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <DoctorDetailShell doctor={doctor}>
        <DoctorDetailHeader
          patientId={patient.patientId}
          doctor={doctor}
          actionsSlot={
            <>
              <DoctorBriefButton
                patientId={patient.patientId}
                doctorId={doctor.id}
                doctorName={doctor.name}
              />
              <DoctorActionsMenu
                patientId={patient.patientId}
                doctorId={doctor.id}
                doctorName={doctor.name}
              />
            </>
          }
        />

        <DoctorCurrentSection doctor={doctor} lastVisit={lastVisit} />

        <DoctorHistorySection
          totalCount={totalCount}
          recentEntries={recentEntries}
          olderEntries={olderEntries}
        />

        {hasLinks ? (
          <DoctorLinkedContext
            patientId={patient.patientId}
            linkedMeds={linkedMeds}
            linkedConditions={linkedConditions}
            linkedLabOrders={linkedLabOrders}
            linkedVisits={linkedVisits}
          />
        ) : null}

        <DoctorNotesSection notes={notesText} />
      </DoctorDetailShell>

      <AskAiButton surface={{ key: "doctor", id: doctor.id }} />
    </main>
  );
}
