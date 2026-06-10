import { notFound } from "next/navigation";
import { z } from "zod";

import { AskAiButton } from "@/components/ask-ai-button";
import { ConditionActionsMenu } from "@/components/conditions/condition-actions-menu";
import {
  ConditionChangeEntry,
  type DoctorRef,
} from "@/components/conditions/condition-change-entry";
import { ConditionCurrentSection } from "@/components/conditions/condition-current-section";
import { ConditionDetailHeader } from "@/components/conditions/condition-detail-header";
import { ConditionDetailShell } from "@/components/conditions/condition-detail-shell";
import { ConditionHistorySection } from "@/components/conditions/condition-history-section";
import {
  ConditionLinkedContext,
  type LinkedLabRef,
  type LinkedMedRef,
} from "@/components/conditions/condition-linked-context";
import type { DoctorOption } from "@/components/conditions/condition-log-change-dialog";
import { ConditionNotesSection } from "@/components/conditions/condition-notes-section";
import {
  conditionChangeQueries,
  conditionQueries,
} from "@/db/queries/condition";
import { doctorQueries } from "@/db/queries/doctor";
import { labResultQueries } from "@/db/queries/lab";
import { medicationQueries } from "@/db/queries/medication";
import { getCurrentPatient } from "@/lib/auth";
import { conditionSurfaceContext } from "@/lib/chat/surface-context";
import { todayInTimezone } from "@/lib/datetime";

const conditionIdParam = z.string().uuid();
const RECENT_LIMIT = 5;

export default async function ConditionDetailPage({
  params,
}: {
  params: Promise<{ id: string; conditionId: string }>;
}) {
  const { id, conditionId: rawConditionId } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  const idCheck = conditionIdParam.safeParse(rawConditionId);
  if (!idCheck.success) notFound();
  const conditionId = idCheck.data;

  const [condition, changes, doctors, medications, labResults] =
    await Promise.all([
      conditionQueries.getById(patient.patientId, conditionId),
      conditionChangeQueries.forCondition(patient.patientId, conditionId),
      doctorQueries.forPatient(patient.patientId),
      medicationQueries.forPatient(patient.patientId),
      labResultQueries.forPatient(patient.patientId),
    ]);

  if (!condition) notFound();

  const doctorMap = new Map(doctors.map((d) => [d.id, d]));
  const managingDoctor = condition.managingDoctor
    ? doctorMap.get(condition.managingDoctor)
    : undefined;
  const diagnosedByDoctor = condition.diagnosedBy
    ? doctorMap.get(condition.diagnosedBy)
    : undefined;

  // Narrow lookup containing only doctors referenced by managing_doctor changes
  // — keeps the payload that crosses to ConditionChangeEntry tight.
  const doctorLookup: Record<string, DoctorRef> = {};
  for (const c of changes) {
    if (c.field !== "managing_doctor") continue;
    for (const uuid of [c.oldValue, c.newValue]) {
      if (!uuid || doctorLookup[uuid]) continue;
      const d = doctorMap.get(uuid);
      if (d) doctorLookup[uuid] = { name: d.name, specialty: d.specialty };
    }
  }

  // Linked context: medications treating this condition (purpose) + lab markers
  // monitoring it (linkedCondition). Section omitted entirely when both empty.
  const linkedMeds: LinkedMedRef[] = medications
    .filter((m) => m.purpose === conditionId)
    .map((m) => ({
      id: m.id,
      name: m.name,
      currentDose: m.currentDose,
      status: m.status,
    }));
  const linkedLabs: LinkedLabRef[] = labResults
    .filter((r) => r.linkedCondition === conditionId)
    .map((r) => ({
      id: r.id,
      marker: r.marker,
      resultDate: r.resultDate,
      flag: r.flag,
    }));

  // Pre-render entry arrays server-side; the History island just toggles
  // visibility. Collapse only when total > RECENT_LIMIT.
  const totalCount = changes.length;
  const recentEntries = changes.slice(0, RECENT_LIMIT).map((c) => (
    <ConditionChangeEntry key={c.id} change={c} doctorLookup={doctorLookup} />
  ));
  const olderEntries =
    totalCount > RECENT_LIMIT
      ? changes.slice(RECENT_LIMIT).map((c) => (
          <ConditionChangeEntry
            key={c.id}
            change={c}
            doctorLookup={doctorLookup}
          />
        ))
      : null;

  const notesText = condition.notes?.trim() ?? "";
  const todayInPatientTz = todayInTimezone(patient.timezone);

  const doctorOptions: DoctorOption[] = doctors.map((d) => ({
    id: d.id,
    name: d.name,
    specialty: d.specialty,
  }));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <ConditionDetailShell
        condition={condition}
        doctors={doctorOptions}
        todayInPatientTz={todayInPatientTz}
      >
        <ConditionDetailHeader
          patientId={patient.patientId}
          condition={condition}
          actionsSlot={
            <ConditionActionsMenu
              patientId={patient.patientId}
              conditionId={condition.id}
              conditionName={condition.name}
            />
          }
        />

        <ConditionCurrentSection
          condition={condition}
          managingDoctor={managingDoctor}
          diagnosedByDoctor={diagnosedByDoctor}
        />

        <ConditionHistorySection
          totalCount={totalCount}
          recentEntries={recentEntries}
          olderEntries={olderEntries}
        />

        {linkedMeds.length > 0 || linkedLabs.length > 0 ? (
          <ConditionLinkedContext
            patientId={patient.patientId}
            linkedMeds={linkedMeds}
            linkedLabs={linkedLabs}
          />
        ) : null}

        <ConditionNotesSection notes={notesText} />
      </ConditionDetailShell>

      <AskAiButton surfaceContext={conditionSurfaceContext(condition)} />
    </main>
  );
}
