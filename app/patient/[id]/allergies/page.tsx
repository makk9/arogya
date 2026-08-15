import Link from "next/link";
import { notFound } from "next/navigation";

import { AllergyCard } from "@/components/allergies/allergy-card";
import { AllergyEmptyState } from "@/components/allergies/allergy-empty-state";
import { AllergyFilters } from "@/components/allergies/allergy-filters";
import { STATUS_OPTIONS } from "@/components/allergies/allergy-options";
import { EntityListSections } from "@/components/entity-list-sections";
import { AskAiButton } from "@/components/ask-ai-button";
import { Breadcrumb } from "@/components/breadcrumb";
import { buttonVariants } from "@/components/ui/button";
import {
  allergyCategory,
  allergyStatus,
  type Allergy,
  type Doctor,
} from "@/db/schema";
import { allergyQueries } from "@/db/queries/allergy";
import { doctorQueries } from "@/db/queries/doctor";
import { getCurrentPatient } from "@/lib/auth";

type Status = (typeof allergyStatus.enumValues)[number];
type Category = (typeof allergyCategory.enumValues)[number];

const VALID_CATEGORY = new Set<string>(allergyCategory.enumValues);

/*
 * Allergies list per the §6.4 state-list template. §6.4 powers four rail items
 * and Allergies isn't one — this page is reached from the patient profile's
 * `Allergies · N list →` link (§6.10:1678) and exists as the `+ Add` host and
 * detail-page parent. Grouping is a Phase D call (decisions.md 2026-06-10):
 * by status — ACTIVE + SUSPECTED expanded (suspected is medically meaningful
 * per §4:271), RESOLVED + DISPROVED collapsed.
 */

// Subtitle words = the shared status labels lowercased (reads as prose, e.g.
// "2 active · 1 suspected").
const STATUS_WORD: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label.toLowerCase()]),
);

function pickFirst(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AllergiesListPage({
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

  const [allAllergies, doctors] = await Promise.all([
    allergyQueries.forPatient(patient.patientId),
    doctorQueries.forPatient(patient.patientId),
  ]);

  const doctorMap = new Map<string, Doctor>(doctors.map((d) => [d.id, d]));

  const filtered = allAllergies.filter(
    (a) => !categoryFilter || a.category === categoryFilter,
  );

  const groups: Record<Status, Allergy[]> = {
    active: [],
    suspected: [],
    resolved: [],
    disproved: [],
  };
  for (const a of filtered) groups[a.status].push(a);

  // Subtitle: non-zero status buckets in display order (the clinical
  // STATUS_OPTIONS order). Title shows the absolute total; subtitle reflects
  // the post-filter view (same asymmetry as Medication/Condition).
  const subtitleParts = STATUS_OPTIONS.filter(
    (o) => groups[o.value].length > 0,
  ).map((o) => `${groups[o.value].length} ${STATUS_WORD[o.value]}`);

  const totalCount = allAllergies.length;
  const filteredCount = filtered.length;

  function renderCards(list: Allergy[]) {
    return list.map((a) => (
      <AllergyCard
        key={a.id}
        patientId={patient.patientId}
        allergy={a}
        doctor={a.confirmedBy ? doctorMap.get(a.confirmedBy) : undefined}
      />
    ));
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Breadcrumb patientId={id} trail={[{ label: "allergies" }]} />

      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold leading-tight">
          <span className="border-b-2 border-destructive pb-1">Allergies</span>
          {totalCount > 0 ? (
            <span className="ml-2 text-muted-foreground">· {totalCount}</span>
          ) : null}
        </h1>
        <Link
          href={`/patient/${id}/allergies/new`}
          className={buttonVariants()}
        >
          + Add allergy
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
          <AllergyFilters />
        </div>
      ) : null}

      {totalCount === 0 ? (
        <AllergyEmptyState patientId={patient.patientId} />
      ) : filteredCount === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
          No allergies match these filters.
        </p>
      ) : (
        <EntityListSections
          idPrefix="allergies"
          sections={[
            {
              slug: "active",
              label: "Active",
              count: groups.active.length,
              defaultOpen: true,
              cards: renderCards(groups.active),
            },
            {
              slug: "suspected",
              label: "Suspected",
              count: groups.suspected.length,
              defaultOpen: true,
              cards: renderCards(groups.suspected),
            },
            {
              slug: "resolved",
              label: "Resolved",
              count: groups.resolved.length,
              defaultOpen: false,
              cards: renderCards(groups.resolved),
            },
            {
              slug: "disproved",
              label: "Disproved",
              count: groups.disproved.length,
              defaultOpen: false,
              cards: renderCards(groups.disproved),
            },
          ]}
        />
      )}

      <AskAiButton surface={{ key: "allergies-list" }} />
    </main>
  );
}
