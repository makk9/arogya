import Link from "next/link";
import { notFound } from "next/navigation";

import { FamilyHistoryCard } from "@/components/family-history/family-history-card";
import { FamilyHistoryEmptyState } from "@/components/family-history/family-history-empty-state";
import { RELATION_GROUPS } from "@/components/family-history/family-history-options";
import { EntityListSections } from "@/components/entity-list-sections";
import { AskAiButton } from "@/components/ask-ai-button";
import { Breadcrumb } from "@/components/breadcrumb";
import { buttonVariants } from "@/components/ui/button";
import type { FamilyHistoryEntry } from "@/db/schema";
import { familyHistoryQueries } from "@/db/queries/family-history";
import { getCurrentPatient } from "@/lib/auth";

/*
 * Family history list per the §6.4 state-list template — a first-class wiki
 * rail item (§4:561), grouped by relation type per §6.4:1336: PARENTS /
 * SIBLINGS / CHILDREN expanded, GRANDPARENTS / OTHER collapsed. No filter
 * pills (§6.4:1343 — grouping by relation does the work). No searchParams.
 */

export default async function FamilyHistoryListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  const entries = await familyHistoryQueries.forPatient(patient.patientId);

  const groups = RELATION_GROUPS.map((g) => ({
    ...g,
    entries: entries.filter((e) =>
      (g.relations as ReadonlyArray<string>).includes(e.relation),
    ),
  }));

  // Subtitle: non-zero relation buckets in display order, lowercased group
  // labels read as prose ("2 parents · 1 sibling").
  const subtitleParts = groups
    .filter((g) => g.entries.length > 0)
    .map((g) => `${g.entries.length} ${subtitleWord(g.label, g.entries.length)}`);

  const totalCount = entries.length;

  function renderCards(list: FamilyHistoryEntry[]) {
    return list.map((e) => (
      <FamilyHistoryCard key={e.id} patientId={patient.patientId} entry={e} />
    ));
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Breadcrumb patientId={id} trail={[{ label: "family-history" }]} />

      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold leading-tight">
          <span className="border-b-2 border-destructive pb-1">
            Family history
          </span>
          {totalCount > 0 ? (
            <span className="ml-2 text-muted-foreground">· {totalCount}</span>
          ) : null}
        </h1>
        <Link
          href={`/patient/${id}/family-history/new`}
          className={buttonVariants()}
        >
          + Add family history
        </Link>
      </div>

      {subtitleParts.length > 0 ? (
        <p className="mb-6 text-sm text-muted-foreground">
          {subtitleParts.join(" · ")}
        </p>
      ) : (
        <div className="mb-6" />
      )}

      {totalCount === 0 ? (
        <FamilyHistoryEmptyState patientId={patient.patientId} />
      ) : (
        <EntityListSections
          idPrefix="family-history"
          sections={groups.map((g) => ({
            slug: g.slug,
            label: g.label,
            count: g.entries.length,
            defaultOpen: g.defaultOpen,
            cards: renderCards(g.entries),
          }))}
        />
      )}

      <AskAiButton surface={{ key: "family-history-list" }} />
    </main>
  );
}

// "2 parents", "1 sibling" — singularizes the group label for counts of one.
// Group labels are simple plural-s words ("Parents", "Children" is irregular
// but "1 child" reads right via the special case).
function subtitleWord(groupLabel: string, count: number): string {
  const plural = groupLabel.toLowerCase();
  if (count !== 1) return plural;
  if (plural === "children") return "child";
  if (plural === "other") return "other";
  return plural.replace(/s$/, "");
}
