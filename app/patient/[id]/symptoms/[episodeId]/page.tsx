import { notFound } from "next/navigation";
import { z } from "zod";

import { AskAiButton } from "@/components/ask-ai-button";
import { EpisodeActionsMenu } from "@/components/symptoms/episode-actions-menu";
import { EpisodeBodySection } from "@/components/symptoms/episode-body-section";
import { EpisodeCapturedSection } from "@/components/symptoms/episode-captured-section";
import { EpisodeDetailHeader } from "@/components/symptoms/episode-detail-header";
import { EpisodeDetailShell } from "@/components/symptoms/episode-detail-shell";
import { EpisodeLinkedContextSection } from "@/components/symptoms/episode-linked-context-section";
import { EpisodeNotesSection } from "@/components/symptoms/episode-notes-section";
import { doctorQueries } from "@/db/queries/doctor";
import { symptomEpisodeQueries, symptomTypeQueries } from "@/db/queries/symptom";
import { visitQueries } from "@/db/queries/visit";
import { vitalQueries } from "@/db/queries/vital";
import type { VitalReading } from "@/db/schema";
import { getCurrentPatient } from "@/lib/auth";
import { symptomEpisodeSurfaceContext } from "@/lib/chat/surface-context";
import { formatAbsoluteDate } from "@/lib/datetime";
import { displayDoctorName } from "@/lib/doctor-display";

/*
 * SymptomEpisode detail per the §6.7 event-detail template. Section order:
 * body (EPISODE NOTES) → Captured at this episode (linked vitals, the renamed
 * Outcomes) → Linked context (parent type + nearby episodes) → Notes. No
 * History (events have no change log). The explicit parent-link to the
 * SymptomType lives in the header chip (§6.7:1509).
 */

const episodeIdParam = z.string().uuid();

export default async function EpisodeDetailPage({
  params,
}: {
  params: Promise<{ id: string; episodeId: string }>;
}) {
  const { id, episodeId: rawEpisodeId } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  const idCheck = episodeIdParam.safeParse(rawEpisodeId);
  if (!idCheck.success) notFound();

  const episode = await symptomEpisodeQueries.getById(patient.patientId, idCheck.data);
  if (!episode) notFound();

  const [type, siblings, doctors, visits, allVitals] = await Promise.all([
    symptomTypeQueries.getById(patient.patientId, episode.symptomTypeId),
    symptomEpisodeQueries.siblings(
      patient.patientId,
      episode.symptomTypeId,
      episode.id,
    ),
    doctorQueries.forPatient(patient.patientId),
    visitQueries.forPatient(patient.patientId),
    vitalQueries.forPatient(patient.patientId),
  ]);

  // Parent type should always resolve (FK), but guard defensively.
  if (!type) notFound();

  // Derive the linked readings from the full set (one fetch backs both the
  // "Captured at this episode" display and the Edit-mode "+ Link a reading"
  // picker). Filter preserves allVitals' recorded-desc order.
  const linkedIdSet = new Set(episode.linkedVitalIds ?? []);
  const linkedVitals: VitalReading[] = allVitals.filter((v) =>
    linkedIdSet.has(v.id),
  );

  const doctorMap = new Map(doctors.map((d) => [d.id, d]));
  const visitOptions = visits.map((v) => {
    const d = doctorMap.get(v.doctorId);
    return {
      value: v.id,
      label: `${d ? displayDoctorName(d.name) : "Visit"} · ${formatAbsoluteDate(v.visitDate)}`,
    };
  });
  const linkedVisit = episode.linkedVisitId
    ? visits.find((v) => v.id === episode.linkedVisitId)
    : undefined;
  const linkedVisitLabel = linkedVisit
    ? `${
        doctorMap.get(linkedVisit.doctorId)
          ? displayDoctorName(doctorMap.get(linkedVisit.doctorId)!.name)
          : "Visit"
      } · ${formatAbsoluteDate(linkedVisit.visitDate)}`
    : null;

  const episodeLabel = `${type.name} · ${formatAbsoluteDate(episode.startedAt)}`;
  const notesText = episode.notes?.trim() ?? "";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <EpisodeDetailShell episode={episode}>
        <EpisodeDetailHeader
          patientId={patient.patientId}
          episode={episode}
          typeId={type.id}
          typeName={type.name}
          actionsSlot={
            <EpisodeActionsMenu
              patientId={patient.patientId}
              episodeId={episode.id}
              episodeLabel={episodeLabel}
            />
          }
        />

        <div className="mt-6">
          <EpisodeBodySection
            patientId={patient.patientId}
            episode={episode}
            linkedVisitLabel={linkedVisitLabel}
            visitOptions={visitOptions}
          />
        </div>

        <EpisodeCapturedSection
          linkedVitals={linkedVitals}
          allVitals={allVitals}
        />

        <EpisodeLinkedContextSection
          patientId={patient.patientId}
          typeName={type.name}
          thisEpisodeAt={episode.startedAt}
          siblings={siblings}
        />

        <EpisodeNotesSection notes={notesText} />
      </EpisodeDetailShell>

      <AskAiButton
        surfaceContext={symptomEpisodeSurfaceContext({
          symptomTypeName: type.name,
          startedAt: episode.startedAt.toISOString().slice(0, 10),
          severity: episode.severity,
        })}
      />
    </main>
  );
}
