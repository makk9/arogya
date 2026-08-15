import Link from "next/link";
import { notFound } from "next/navigation";

import { AskAiButton } from "@/components/ask-ai-button";
import { Breadcrumb } from "@/components/breadcrumb";
import { SymptomEmptyState } from "@/components/symptoms/symptom-empty-state";
import { SymptomEpisodeCard } from "@/components/symptoms/symptom-episode-card";
import {
  SymptomTimeline,
  type SymptomTypeGroup,
} from "@/components/symptoms/symptom-timeline";
import { STATUS_ORDER } from "@/components/symptoms/symptom-options";
import { buttonVariants } from "@/components/ui/button";
import { symptomEpisodeQueries, symptomTypeQueries } from "@/db/queries/symptom";
import { vitalQueries } from "@/db/queries/vital";
import type { SymptomEpisode, SymptomType, VitalReading } from "@/db/schema";
import { getCurrentPatient } from "@/lib/auth";
import { formatRelative } from "@/lib/datetime";

/*
 * Symptoms timeline per §6.6 — the one rail item grouped by symptom TYPE, not by
 * month. Page count is symptom types (`Symptoms · 9`); the secondary line counts
 * both axes (`9 symptom types · 23 episodes logged · most recent 6 days ago`).
 * Types sort by status precedence (active first) then by most-recent episode;
 * active types render expanded, the rest collapsed. The single globally-most-
 * recent episode carries the §6.6 most-recent tint.
 */
export default async function SymptomsTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  const [types, episodes] = await Promise.all([
    symptomTypeQueries.forPatient(patient.patientId),
    symptomEpisodeQueries.forPatient(patient.patientId),
  ]);

  // Resolve every linked vital across all episodes in one batch, then map by id
  // so each card gets its `●` pills without an N+1.
  const vitalIds = [
    ...new Set(episodes.flatMap((e) => e.linkedVitalIds ?? [])),
  ];
  const vitals = await vitalQueries.byIds(patient.patientId, vitalIds);
  const vitalById = new Map<string, VitalReading>(vitals.map((v) => [v.id, v]));

  // Episodes grouped by type (each list stays newest-first from the desc query).
  const episodesByType = new Map<string, SymptomEpisode[]>();
  for (const e of episodes) {
    const list = episodesByType.get(e.symptomTypeId) ?? [];
    list.push(e);
    episodesByType.set(e.symptomTypeId, list);
  }

  // The single most-recent episode overall — gets the §6.6 most-recent tint.
  const mostRecentEpisodeId = episodes[0]?.id ?? null;

  const mostRecentEpisodeAt = (t: SymptomType): number => {
    const list = episodesByType.get(t.id);
    return list && list.length > 0 ? list[0].startedAt.getTime() : 0;
  };

  // Sort: status precedence → most-recent episode desc → name.
  const sortedTypes = types.slice().sort((a, b) => {
    const sa = STATUS_ORDER[a.status] ?? 99;
    const sb = STATUS_ORDER[b.status] ?? 99;
    if (sa !== sb) return sa - sb;
    const ra = mostRecentEpisodeAt(a);
    const rb = mostRecentEpisodeAt(b);
    if (ra !== rb) return rb - ra;
    return a.name.localeCompare(b.name);
  });

  const linkedVitalsFor = (e: SymptomEpisode): VitalReading[] =>
    (e.linkedVitalIds ?? [])
      .map((vid) => vitalById.get(vid))
      .filter((v): v is VitalReading => v !== undefined);

  const groups: SymptomTypeGroup[] = sortedTypes.map((t) => {
    const list = episodesByType.get(t.id) ?? [];
    return {
      typeId: t.id,
      name: t.name,
      status: t.status,
      episodeCount: list.length,
      defaultOpen: t.status === "active",
      typeHref: `/patient/${patient.patientId}/symptoms/types/${t.id}`,
      cards: list.map((e) => (
        <SymptomEpisodeCard
          key={e.id}
          patientId={patient.patientId}
          episode={e}
          linkedVitals={linkedVitalsFor(e)}
          mostRecent={e.id === mostRecentEpisodeId}
        />
      )),
    };
  });

  const typeCount = types.length;
  const episodeCount = episodes.length;

  const subtitleParts: string[] = [];
  if (typeCount > 0) {
    subtitleParts.push(
      `${typeCount} symptom ${typeCount === 1 ? "type" : "types"}`,
    );
  }
  if (episodeCount > 0) {
    subtitleParts.push(
      `${episodeCount} ${episodeCount === 1 ? "episode" : "episodes"} logged`,
    );
  }
  if (episodes[0]) {
    subtitleParts.push(`most recent ${formatRelative(episodes[0].startedAt)}`);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Breadcrumb patientId={id} trail={[{ label: "symptoms" }]} />

      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold leading-tight">
          <span className="border-b-2 border-destructive pb-1">Symptoms</span>
          {typeCount > 0 ? (
            <span className="ml-2 text-muted-foreground">· {typeCount}</span>
          ) : null}
        </h1>
        <Link
          href={`/patient/${id}/symptoms/new`}
          className={buttonVariants()}
        >
          + Log symptom
        </Link>
      </div>

      {subtitleParts.length > 0 ? (
        <p className="mb-6 text-sm text-muted-foreground">
          {subtitleParts.join(" · ")}
        </p>
      ) : (
        <div className="mb-6" />
      )}

      {typeCount === 0 ? (
        <SymptomEmptyState patientId={patient.patientId} />
      ) : (
        <SymptomTimeline groups={groups} />
      )}

      <AskAiButton surface={{ key: "symptoms-list" }} />
    </main>
  );
}
