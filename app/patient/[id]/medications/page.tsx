import Link from "next/link";
import { notFound } from "next/navigation";

import { AskAiButton } from "@/components/ask-ai-button";
import { Breadcrumb } from "@/components/breadcrumb";
import { MEDICATIONS_LIST_SURFACE } from "@/lib/chat/surface-context";
import { EntityListSections } from "@/components/entity-list-sections";
import { MedicationCard } from "@/components/medications/medication-card";
import { MedicationEmptyState } from "@/components/medications/medication-empty-state";
import { MedicationFilters } from "@/components/medications/medication-filters";
import { buttonVariants } from "@/components/ui/button";
import {
  medicationCategory,
  medicationStatus,
  type Condition,
  type Doctor,
  type Medication,
} from "@/db/schema";
import { conditionQueries } from "@/db/queries/condition";
import { doctorQueries } from "@/db/queries/doctor";
import { medicationQueries } from "@/db/queries/medication";
import { getCurrentPatient } from "@/lib/auth";

type Status = (typeof medicationStatus.enumValues)[number];
type Category = (typeof medicationCategory.enumValues)[number];

const VALID_STATUS = new Set<string>(medicationStatus.enumValues);
const VALID_CATEGORY = new Set<string>(medicationCategory.enumValues);

function pickFirst(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MedicationsListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  const sp = await searchParams;
  const rawStatus = pickFirst(sp.status);
  const rawCategory = pickFirst(sp.category);
  const statusFilter: Status | null =
    rawStatus && VALID_STATUS.has(rawStatus) ? (rawStatus as Status) : null;
  const categoryFilter: Category | null =
    rawCategory && VALID_CATEGORY.has(rawCategory)
      ? (rawCategory as Category)
      : null;

  const [allMeds, doctors, conditions] = await Promise.all([
    medicationQueries.forPatient(patient.patientId),
    doctorQueries.forPatient(patient.patientId),
    conditionQueries.forPatient(patient.patientId),
  ]);

  const doctorMap = new Map<string, Doctor>(doctors.map((d) => [d.id, d]));
  const conditionMap = new Map<string, Condition>(
    conditions.map((c) => [c.id, c]),
  );

  const filtered = allMeds.filter((m) => {
    if (statusFilter && m.status !== statusFilter) return false;
    if (categoryFilter && m.category !== categoryFilter) return false;
    return true;
  });

  const groups: Record<Status, Medication[]> = {
    active: [],
    paused: [],
    discontinued: [],
  };
  for (const m of filtered) groups[m.status].push(m);

  const activeCount = groups.active.length;
  const pausedCount = groups.paused.length;
  const discontinuedCount = groups.discontinued.length;

  // Distinct specialties = unique doctor.specialty values across post-filter
  // active+paused meds (excludes discontinued — the synthesis question is
  // "who's prescribing now"). Plan D6.
  const specialties = new Set<string>();
  for (const m of [...groups.active, ...groups.paused]) {
    if (!m.prescribingDoctor) continue;
    const d = doctorMap.get(m.prescribingDoctor);
    if (d) specialties.add(d.specialty);
  }
  const specialtyCount = specialties.size;

  // Subtitle: omit any zero segment (plan D8). All-zero falls through to the
  // no-matches or empty-state path so the subtitle never renders empty.
  const subtitleParts: string[] = [];
  if (activeCount > 0) subtitleParts.push(`${activeCount} active`);
  if (pausedCount > 0) subtitleParts.push(`${pausedCount} paused`);
  if (discontinuedCount > 0)
    subtitleParts.push(`${discontinuedCount} discontinued`);
  if (specialtyCount > 0)
    subtitleParts.push(
      `${specialtyCount} ${specialtyCount === 1 ? "specialist" : "specialists"} prescribing`,
    );

  // Title shows the absolute total (`Medications · 7`); subtitle reflects the
  // post-filter view (`2 active · 1 specialist prescribing`). Asymmetry is
  // deliberate — title is the inventory fact, subtitle is the current cut.
  const totalCount = allMeds.length;
  const filteredCount = filtered.length;

  function renderCards(meds: Medication[]) {
    return meds.map((m) => (
      <MedicationCard
        key={m.id}
        patientId={patient.patientId}
        medication={m}
        doctor={m.prescribingDoctor ? doctorMap.get(m.prescribingDoctor) : undefined}
        condition={m.purpose ? conditionMap.get(m.purpose) : undefined}
      />
    ));
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {/*
        Breadcrumb shape per design.md 6.12:1833. Patient ID truncated to
        first 8 chars — see new/page.tsx for rationale; behavior is identical
        here.
      */}
      <Breadcrumb patientId={id} trail={[{ label: "medications" }]} />

      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold leading-tight">
          <span className="border-b-2 border-destructive pb-1">
            Medications
          </span>
          {totalCount > 0 ? (
            <span className="ml-2 text-muted-foreground">· {totalCount}</span>
          ) : null}
        </h1>
        <Link
          href={`/patient/${id}/medications/new`}
          className={buttonVariants()}
        >
          + Add medication
        </Link>
      </div>

      {subtitleParts.length > 0 ? (
        <p className="mb-6 text-sm text-muted-foreground">
          {subtitleParts.join(" · ")}
        </p>
      ) : (
        <div className="mb-6" />
      )}

      {totalCount > 0 ? (
        <div className="mb-6 flex justify-end">
          <MedicationFilters />
        </div>
      ) : null}

      {totalCount === 0 ? (
        <MedicationEmptyState patientId={patient.patientId} />
      ) : filteredCount === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
          No medications match these filters.
        </p>
      ) : (
        // Open-defaults per plan D4: ACTIVE expanded, PAUSED + DISCONTINUED
        // collapsed.
        <EntityListSections
          idPrefix="medications"
          sections={[
            {
              slug: "active",
              label: "Active",
              count: activeCount,
              defaultOpen: true,
              cards: renderCards(groups.active),
            },
            {
              slug: "paused",
              label: "Paused",
              count: pausedCount,
              defaultOpen: false,
              cards: renderCards(groups.paused),
            },
            {
              slug: "discontinued",
              label: "Discontinued",
              count: discontinuedCount,
              defaultOpen: false,
              cards: renderCards(groups.discontinued),
            },
          ]}
        />
      )}

      <AskAiButton surfaceContext={MEDICATIONS_LIST_SURFACE} />
    </main>
  );
}
