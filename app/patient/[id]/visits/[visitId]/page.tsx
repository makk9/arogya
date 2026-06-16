import { notFound } from "next/navigation";
import { z } from "zod";

import { AskAiButton } from "@/components/ask-ai-button";
import { VisitActionsMenu } from "@/components/visits/visit-actions-menu";
import { VisitBodySection } from "@/components/visits/visit-body-section";
import { VisitDetailHeader } from "@/components/visits/visit-detail-header";
import { VisitDetailShell } from "@/components/visits/visit-detail-shell";
import { VisitLinkedContextSection } from "@/components/visits/visit-linked-context-section";
import { VisitNotesSection } from "@/components/visits/visit-notes-section";
import { VisitOutcomesSection } from "@/components/visits/visit-outcomes-section";
import { buildOutcomeItems } from "@/components/visits/visit-outcome-model";
import { doctorQueries } from "@/db/queries/doctor";
import { visitQueries } from "@/db/queries/visit";
import { getCurrentPatient } from "@/lib/auth";
import { visitSurfaceContext } from "@/lib/chat/surface-context";
import { formatAbsoluteDate } from "@/lib/datetime";
import { displayDoctorName } from "@/lib/doctor-display";

/*
 * Visit detail per the §6.7 event-detail template — its first implementation.
 * Section order: body (NOTES FROM VISIT) → Outcomes → Linked context → Notes.
 * No History section (events have no change log); Outcomes renders the
 * linked_visit_id backlinks; Linked context carries the temporal
 * forward-links. Outcomes / Linked context are omitted when empty.
 */

const visitIdParam = z.string().uuid();

export default async function VisitDetailPage({
  params,
}: {
  params: Promise<{ id: string; visitId: string }>;
}) {
  const { id, visitId: rawVisitId } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  const idCheck = visitIdParam.safeParse(rawVisitId);
  if (!idCheck.success) notFound();
  const visitId = idCheck.data;

  const [visit, outcomes, episodes, doctors] = await Promise.all([
    visitQueries.getById(patient.patientId, visitId),
    visitQueries.outcomesForVisit(patient.patientId, visitId),
    visitQueries.linkedEpisodesForVisit(patient.patientId, visitId),
    doctorQueries.forPatient(patient.patientId),
  ]);

  if (!visit) notFound();

  const doctor = doctors.find((d) => d.id === visit.doctorId);
  const outcomeItems = buildOutcomeItems(outcomes, patient.patientId);

  const doctorOptions = doctors.map((d) => ({
    value: d.id,
    label: `${displayDoctorName(d.name)} · ${d.specialty}`,
  }));

  const visitLabel = `${doctor ? displayDoctorName(doctor.name) : "—"} · ${formatAbsoluteDate(visit.visitDate)}`;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <VisitDetailShell visit={visit}>
        <VisitDetailHeader
          patientId={patient.patientId}
          visit={visit}
          doctor={doctor}
          doctorOptions={doctorOptions}
          actionsSlot={
            <VisitActionsMenu
              patientId={patient.patientId}
              visitId={visit.id}
              visitLabel={visitLabel}
              outcomeCount={outcomeItems.length}
            />
          }
        />

        <div className="mt-6">
          <VisitBodySection visit={visit} />
        </div>

        <VisitOutcomesSection outcomes={outcomeItems} />

        <VisitLinkedContextSection
          visitDate={visit.visitDate}
          episodes={episodes}
        />

        <VisitNotesSection notes={visit.notes?.trim() ?? ""} />
      </VisitDetailShell>

      <AskAiButton
        surfaceContext={visitSurfaceContext({
          visitDate: visit.visitDate,
          doctorName: doctor ? displayDoctorName(doctor.name) : null,
          status: visit.status,
        })}
      />
    </main>
  );
}
