import { notFound } from "next/navigation";
import { z } from "zod";

import { AskAiButton } from "@/components/ask-ai-button";
import { SymptomEpisodeCard } from "@/components/symptoms/symptom-episode-card";
import { TypeActionsMenu } from "@/components/symptoms/type-actions-menu";
import { TypeCurrentSection } from "@/components/symptoms/type-current-section";
import { TypeDetailHeader } from "@/components/symptoms/type-detail-header";
import { TypeDetailShell } from "@/components/symptoms/type-detail-shell";
import { TypeEpisodeStream } from "@/components/symptoms/type-episode-stream";
import { TypeNotesSection } from "@/components/symptoms/type-notes-section";
import { conditionQueries } from "@/db/queries/condition";
import { symptomEpisodeQueries, symptomTypeQueries } from "@/db/queries/symptom";
import { vitalQueries } from "@/db/queries/vital";
import type { VitalReading } from "@/db/schema";
import { getCurrentPatient } from "@/lib/auth";
import { symptomTypeSurfaceContext } from "@/lib/chat/surface-context";

/*
 * SymptomType detail — the parent identity surface, built on the state-detail
 * template (§6.5). Status / body area / linked condition / first noted are
 * inline-editable (no change log → plain PATCH); the episode stream renders the
 * type's occurrences below. This is the target of the episode detail's
 * parent-link and the timeline's "View symptom →" link.
 *
 * Addition beyond the 6.6/6.7 wireframes (signed off 2026-06-16) — it's where a
 * symptom's status transitions (active → resolved) and its condition link get
 * managed; without it those fields would have no edit path.
 */

const typeIdParam = z.string().uuid();

export default async function SymptomTypeDetailPage({
  params,
}: {
  params: Promise<{ id: string; typeId: string }>;
}) {
  const { id, typeId: rawTypeId } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  const idCheck = typeIdParam.safeParse(rawTypeId);
  if (!idCheck.success) notFound();

  const [type, episodes, conditions] = await Promise.all([
    symptomTypeQueries.getById(patient.patientId, idCheck.data),
    symptomEpisodeQueries.forType(patient.patientId, idCheck.data),
    conditionQueries.forPatient(patient.patientId),
  ]);

  if (!type) notFound();

  // Resolve linked vitals across this type's episodes in one batch for the cards.
  const vitalIds = [...new Set(episodes.flatMap((e) => e.linkedVitalIds ?? []))];
  const vitals = await vitalQueries.byIds(patient.patientId, vitalIds);
  const vitalById = new Map<string, VitalReading>(vitals.map((v) => [v.id, v]));

  const linkedCondition = type.linkedCondition
    ? conditions.find((c) => c.id === type.linkedCondition)
    : undefined;

  const mostRecentEpisodeId = episodes[0]?.id ?? null;

  const cards = episodes.map((e) => (
    <SymptomEpisodeCard
      key={e.id}
      patientId={patient.patientId}
      episode={e}
      linkedVitals={(e.linkedVitalIds ?? [])
        .map((vid) => vitalById.get(vid))
        .filter((v): v is VitalReading => v !== undefined)}
      mostRecent={e.id === mostRecentEpisodeId}
    />
  ));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <TypeDetailShell type={type}>
        <TypeDetailHeader
          patientId={patient.patientId}
          type={type}
          episodeCount={episodes.length}
          actionsSlot={
            <TypeActionsMenu
              patientId={patient.patientId}
              typeId={type.id}
              typeName={type.name}
              episodeCount={episodes.length}
            />
          }
        />

        <div className="mt-6">
          <TypeCurrentSection
            patientId={patient.patientId}
            type={type}
            linkedCondition={linkedCondition}
            conditionOptions={conditions.map((c) => ({ id: c.id, name: c.name }))}
          />
        </div>

        <TypeNotesSection notes={type.notes?.trim() ?? ""} />

        <TypeEpisodeStream
          patientId={patient.patientId}
          typeId={type.id}
          count={episodes.length}
          cards={cards}
        />
      </TypeDetailShell>

      <AskAiButton
        surfaceContext={symptomTypeSurfaceContext({
          name: type.name,
          status: type.status,
          episodeCount: episodes.length,
        })}
      />
    </main>
  );
}
