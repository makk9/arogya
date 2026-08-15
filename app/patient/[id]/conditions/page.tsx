import Link from "next/link";
import { notFound } from "next/navigation";

import { AskAiButton } from "@/components/ask-ai-button";
import { Breadcrumb } from "@/components/breadcrumb";
import { ConditionCard } from "@/components/conditions/condition-card";
import { ConditionEmptyState } from "@/components/conditions/condition-empty-state";
import { ConditionFilters } from "@/components/conditions/condition-filters";
import { EntityListSections } from "@/components/entity-list-sections";
import { STATUS_OPTIONS } from "@/components/conditions/condition-options";
import { buttonVariants } from "@/components/ui/button";
import {
  conditionCategory,
  conditionStatus,
  type Condition,
  type Doctor,
} from "@/db/schema";
import { conditionQueries } from "@/db/queries/condition";
import { doctorQueries } from "@/db/queries/doctor";
import { labResultQueries } from "@/db/queries/lab";
import { medicationQueries } from "@/db/queries/medication";
import { getCurrentPatient } from "@/lib/auth";

type Status = (typeof conditionStatus.enumValues)[number];
type Category = (typeof conditionCategory.enumValues)[number];

const VALID_CATEGORY = new Set<string>(conditionCategory.enumValues);

// Subtitle words = the shared status labels lowercased (the subtitle reads as
// prose, e.g. "3 active · 1 in remission"). Derived from STATUS_OPTIONS so a
// label reword can't drift a second hand-maintained map.
const STATUS_WORD: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label.toLowerCase()]),
);

function pickFirst(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ConditionsListPage({
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
  const rawCategory = pickFirst(sp.category);
  const categoryFilter: Category | null =
    rawCategory && VALID_CATEGORY.has(rawCategory)
      ? (rawCategory as Category)
      : null;

  const [allConditions, doctors, medications, labResults] = await Promise.all([
    conditionQueries.forPatient(patient.patientId),
    doctorQueries.forPatient(patient.patientId),
    medicationQueries.forPatient(patient.patientId),
    labResultQueries.forPatient(patient.patientId),
  ]);

  const doctorMap = new Map<string, Doctor>(doctors.map((d) => [d.id, d]));

  // Linked counts per condition: medications via `purpose`, labs via
  // `linkedCondition` (design.md 6.4 condition card line 3).
  const medCountByCondition = new Map<string, number>();
  for (const m of medications) {
    if (!m.purpose) continue;
    medCountByCondition.set(m.purpose, (medCountByCondition.get(m.purpose) ?? 0) + 1);
  }
  const labCountByCondition = new Map<string, number>();
  for (const r of labResults) {
    if (!r.linkedCondition) continue;
    labCountByCondition.set(
      r.linkedCondition,
      (labCountByCondition.get(r.linkedCondition) ?? 0) + 1,
    );
  }

  const filtered = allConditions.filter(
    (c) => !categoryFilter || c.category === categoryFilter,
  );

  const groups: Record<Status, Condition[]> = {
    active: [],
    controlled: [],
    in_remission: [],
    resolved: [],
    suspected: [],
  };
  for (const c of filtered) groups[c.status].push(c);

  // Subtitle: non-zero status buckets in display order. Title shows the absolute
  // total; subtitle reflects the post-filter view (same asymmetry as Medication).
  const statusOrder: Status[] = [
    "active",
    "controlled",
    "in_remission",
    "resolved",
    "suspected",
  ];
  const subtitleParts = statusOrder
    .filter((s) => groups[s].length > 0)
    .map((s) => `${groups[s].length} ${STATUS_WORD[s]}`);

  const totalCount = allConditions.length;
  const filteredCount = filtered.length;

  function renderCards(list: Condition[]) {
    return list.map((c) => (
      <ConditionCard
        key={c.id}
        patientId={patient.patientId}
        condition={c}
        doctor={c.managingDoctor ? doctorMap.get(c.managingDoctor) : undefined}
        medCount={medCountByCondition.get(c.id) ?? 0}
        labCount={labCountByCondition.get(c.id) ?? 0}
      />
    ));
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Breadcrumb patientId={id} trail={[{ label: "conditions" }]} />

      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold leading-tight">
          <span className="border-b-2 border-destructive pb-1">Conditions</span>
          {totalCount > 0 ? (
            <span className="ml-2 text-muted-foreground">· {totalCount}</span>
          ) : null}
        </h1>
        <Link
          href={`/patient/${id}/conditions/new`}
          className={buttonVariants()}
        >
          + Add condition
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
          <ConditionFilters />
        </div>
      ) : null}

      {totalCount === 0 ? (
        <ConditionEmptyState patientId={patient.patientId} />
      ) : filteredCount === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
          No conditions match these filters.
        </p>
      ) : (
        // Open-defaults per 6.4:1334: ACTIVE + CONTROLLED expanded;
        // IN_REMISSION / RESOLVED / SUSPECTED collapsed.
        <EntityListSections
          idPrefix="conditions"
          sections={[
            {
              slug: "active",
              label: "Active",
              count: groups.active.length,
              defaultOpen: true,
              cards: renderCards(groups.active),
            },
            {
              slug: "controlled",
              label: "Controlled",
              count: groups.controlled.length,
              defaultOpen: true,
              cards: renderCards(groups.controlled),
            },
            {
              slug: "in-remission",
              label: "In remission",
              count: groups.in_remission.length,
              defaultOpen: false,
              cards: renderCards(groups.in_remission),
            },
            {
              slug: "resolved",
              label: "Resolved",
              count: groups.resolved.length,
              defaultOpen: false,
              cards: renderCards(groups.resolved),
            },
            {
              slug: "suspected",
              label: "Suspected",
              count: groups.suspected.length,
              defaultOpen: false,
              cards: renderCards(groups.suspected),
            },
          ]}
        />
      )}

      <AskAiButton surface={{ key: "conditions-list" }} />
    </main>
  );
}
