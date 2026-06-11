import { notFound } from "next/navigation";
import { z } from "zod";

import { AskAiButton } from "@/components/ask-ai-button";
import { medicationSurfaceContext } from "@/lib/chat/surface-context";
import { MedicationActionsMenu } from "@/components/medications/medication-actions-menu";
import {
  MedicationChangeEntry,
  type DoctorRef,
  type VisitRef,
} from "@/components/medications/medication-change-entry";
import {
  MedicationCurrentSection,
  type DoseInlineNote,
} from "@/components/medications/medication-current-section";
import { MedicationDetailHeader } from "@/components/medications/medication-detail-header";
import { MedicationDetailShell } from "@/components/medications/medication-detail-shell";
import { MedicationHistorySection } from "@/components/medications/medication-history-section";
import {
  MedicationLinkedContext,
  type LinkedVisitRef,
} from "@/components/medications/medication-linked-context";
import type {
  DoctorOption,
  VisitOption,
} from "@/components/medications/medication-log-change-dialog";
import { MedicationNotesSection } from "@/components/medications/medication-notes-section";
import { conditionQueries } from "@/db/queries/condition";
import { doctorQueries } from "@/db/queries/doctor";
import {
  medicationChangeQueries,
  medicationQueries,
} from "@/db/queries/medication";
import { visitQueries } from "@/db/queries/visit";
import { getCurrentPatient } from "@/lib/auth";

const medicationIdParam = z.string().uuid();
const RECENT_LIMIT = 5;

export default async function MedicationDetailPage({
  params,
}: {
  params: Promise<{ id: string; medicationId: string }>;
}) {
  const { id, medicationId: rawMedicationId } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  const idCheck = medicationIdParam.safeParse(rawMedicationId);
  if (!idCheck.success) notFound();
  const medicationId = idCheck.data;

  const [medication, changes, doctors, conditions, visits] = await Promise.all([
    medicationQueries.getById(patient.patientId, medicationId),
    medicationChangeQueries.forMedication(patient.patientId, medicationId),
    doctorQueries.forPatient(patient.patientId),
    conditionQueries.forPatient(patient.patientId),
    visitQueries.forPatient(patient.patientId),
  ]);

  if (!medication) notFound();

  const doctorMap = new Map(doctors.map((d) => [d.id, d]));
  const conditionMap = new Map(conditions.map((c) => [c.id, c]));
  const visitMap = new Map(visits.map((v) => [v.id, v]));

  const prescribingDoctor = medication.prescribingDoctor
    ? doctorMap.get(medication.prescribingDoctor)
    : undefined;
  const treatsCondition = medication.purpose
    ? conditionMap.get(medication.purpose)
    : undefined;

  // Most-recent dose change whose newValue matches the current dose. If
  // current_dose drifts from the latest change-log row (only reachable
  // v1.5+), we omit the note rather than render stale "changed from".
  const doseChange = changes.find(
    (c) => c.field === "dose" && c.newValue === medication.currentDose,
  );
  const doseInlineNote: DoseInlineNote | null =
    doseChange && doseChange.oldValue
      ? { oldValue: doseChange.oldValue, changedAt: doseChange.changedAt }
      : null;

  // Narrow lookups containing only entries referenced by changes — keeps the
  // payload that crosses to MedicationChangeEntry (RSC, but rendered via
  // ReactNode prop) tight.
  const doctorLookup: Record<string, DoctorRef> = {};
  for (const c of changes) {
    if (c.field !== "prescribing_doctor") continue;
    for (const uuid of [c.oldValue, c.newValue]) {
      if (!uuid || doctorLookup[uuid]) continue;
      const d = doctorMap.get(uuid);
      if (d) doctorLookup[uuid] = { name: d.name, specialty: d.specialty };
    }
  }
  const visitLookup: Record<string, VisitRef> = {};
  for (const c of changes) {
    if (!c.linkedVisitId || visitLookup[c.linkedVisitId]) continue;
    const v = visitMap.get(c.linkedVisitId);
    if (!v) continue;
    const d = doctorMap.get(v.doctorId);
    if (!d) continue;
    visitLookup[c.linkedVisitId] = {
      visitDate: v.visitDate,
      doctorName: d.name,
    };
  }

  // Linked Context: unique visits referenced across all change rows. Section
  // is omitted entirely when empty (per §6.5 LifestyleProfile precedent).
  const seenVisitIds = new Set<string>();
  const linkedVisits: LinkedVisitRef[] = [];
  for (const c of changes) {
    if (!c.linkedVisitId || seenVisitIds.has(c.linkedVisitId)) continue;
    const v = visitMap.get(c.linkedVisitId);
    if (!v) continue;
    const d = doctorMap.get(v.doctorId);
    if (!d) continue;
    seenVisitIds.add(c.linkedVisitId);
    linkedVisits.push({
      id: v.id,
      visitDate: v.visitDate,
      doctorName: d.name,
      visitType: v.visitType ?? null,
    });
  }
  linkedVisits.sort((a, b) => b.visitDate.localeCompare(a.visitDate));

  // Pre-render entry arrays server-side; the client History island just
  // toggles visibility. Collapse only when total > RECENT_LIMIT — a med with
  // ≤5 changes renders everything inline with no "Show all" affordance.
  const totalCount = changes.length;
  const recentEntries = changes.slice(0, RECENT_LIMIT).map((c) => (
    <MedicationChangeEntry
      key={c.id}
      change={c}
      doctorLookup={doctorLookup}
      visitLookup={visitLookup}
    />
  ));
  const olderEntries =
    totalCount > RECENT_LIMIT
      ? changes.slice(RECENT_LIMIT).map((c) => (
          <MedicationChangeEntry
            key={c.id}
            change={c}
            doctorLookup={doctorLookup}
            visitLookup={visitLookup}
          />
        ))
      : null;

  const notesText = medication.notes?.trim() ?? "";
  const showActionsMenu = medication.status !== "discontinued";

  // Flatten doctor + visit lists into the option shapes the log-change dialog
  // expects. All patient doctors / visits are surfaced — the dialog filters
  // out the current prescriber itself.
  const doctorOptions: DoctorOption[] = doctors.map((d) => ({
    id: d.id,
    name: d.name,
    specialty: d.specialty,
  }));
  const visitOptions: VisitOption[] = visits
    .map((v) => {
      const doc = doctorMap.get(v.doctorId);
      if (!doc) return null;
      return {
        id: v.id,
        visitDate: v.visitDate,
        doctorName: doc.name,
      };
    })
    .filter((v): v is VisitOption => v !== null);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <MedicationDetailShell
        medication={medication}
        doctors={doctorOptions}
        visits={visitOptions}
      >
        <MedicationDetailHeader
          patientId={patient.patientId}
          medication={medication}
          actionsSlot={
            showActionsMenu ? (
              <MedicationActionsMenu
                medicationId={medication.id}
                medicationName={medication.name}
              />
            ) : null
          }
        />

        <MedicationCurrentSection
          patientId={patient.patientId}
          medication={medication}
          prescribingDoctor={prescribingDoctor}
          treatsCondition={treatsCondition}
          doseInlineNote={doseInlineNote}
        />

        <MedicationHistorySection
          totalCount={totalCount}
          recentEntries={recentEntries}
          olderEntries={olderEntries}
        />

        {linkedVisits.length > 0 ? (
          <MedicationLinkedContext linkedVisits={linkedVisits} />
        ) : null}

        <MedicationNotesSection notes={notesText} />
      </MedicationDetailShell>

      <AskAiButton surfaceContext={medicationSurfaceContext(medication)} />
    </main>
  );
}
