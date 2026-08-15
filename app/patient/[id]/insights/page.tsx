import { notFound } from "next/navigation";
import { after } from "next/server";

import { AskAiButton } from "@/components/ask-ai-button";
import { Breadcrumb } from "@/components/breadcrumb";
import { EntityListSections } from "@/components/entity-list-sections";
import { InsightCard } from "@/components/insights/insight-card";
import { InsightEmptyState } from "@/components/insights/insight-empty-state";
import { InsightFilters } from "@/components/insights/insight-filters";
import { STATUS_GROUPS } from "@/components/insights/insight-options";
import { resolveEntityRefMap } from "@/db/queries/entity-links";
import { insightQueries } from "@/db/queries/insight";
import { insightCategory, insightStatus, type Insight } from "@/db/schema";
import { getCurrentPatient } from "@/lib/auth";

type Status = (typeof insightStatus.enumValues)[number];

const VALID_STATUS = new Set<string>(insightStatus.enumValues);
const VALID_CATEGORY = new Set<string>(insightCategory.enumValues);

function pickFirst(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Filters are multi-select (§6.8:1593) — the param is a comma-list. Parse to a
// set of valid enum values; unknown tokens are dropped, empty → "all".
function parseFilter(
  value: string | string[] | undefined,
  valid: Set<string>,
): Set<string> {
  const raw = pickFirst(value);
  if (!raw) return new Set();
  return new Set(raw.split(",").filter((v) => valid.has(v)));
}

/*
 * Insights feed per §6.8 — the status-grouped surface for AI-generated patterns.
 * No primary action button (insights are AI-generated, §6.8:1565). Two filter
 * pills (status + category, §6.8:1564). Section groups collapse via the shared
 * EntityListSections; NEW + SEEN open by default, the resolved trio collapsed.
 *
 * In Phase D the rows are seed data (db/seed.ts); Phase E's generator (§5.6)
 * writes into the same table and nothing here changes.
 */
export default async function InsightsFeedPage({
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
  const statusFilter = parseFilter(sp.status, VALID_STATUS);
  const categoryFilter = parseFilter(sp.category, VALID_CATEGORY);

  const allInsights = await insightQueries.forPatient(patient.patientId);

  // Empty filter set = no constraint on that axis; otherwise membership test.
  const filtered = allInsights.filter(
    (i) =>
      (statusFilter.size === 0 || statusFilter.has(i.status)) &&
      (categoryFilter.size === 0 || categoryFilter.has(i.category)),
  );

  // §4:583 new→seen on load of the insights surface (feed until E0a's
  // dashboard exists). Only the insights this view actually DISPLAYS flip — a
  // filtered view must not mark hidden ones seen. Post-response via after():
  // this render still shows the NEW grouping and the rail badge; both clear on
  // the next navigation — standard unread semantics. Silent failure is fine
  // (retries on next visit).
  const displayedNewIds = filtered
    .filter((i) => i.status === "new")
    .map((i) => i.id);
  if (displayedNewIds.length > 0) {
    after(async () => {
      try {
        await insightQueries.markSeen(patient.patientId, displayedNewIds);
      } catch {
        // Non-fatal — the transition re-runs on the next feed load.
      }
    });
  }

  // Resolve the headline `linked_entities` to navigable card-pill labels.
  // Collect the deduped union of refs across the whole feed and resolve it
  // ONCE (one query per distinct entity type for the page) — many cards share
  // the same headline entity, so per-insight resolution would re-query it. Each
  // insight's pills are then read back from the shared map, in ref order.
  const seenRef = new Set<string>();
  const unionRefs: { type: string; id: string }[] = [];
  for (const i of filtered) {
    for (const ref of i.linkedEntities ?? []) {
      const key = `${ref.type}:${ref.id}`;
      if (!seenRef.has(key)) {
        seenRef.add(key);
        unionRefs.push(ref);
      }
    }
  }
  const linkMap = await resolveEntityRefMap(patient.patientId, unionRefs);
  const linksByInsight = new Map(
    filtered.map((i) => [
      i.id,
      (i.linkedEntities ?? []).flatMap((ref) => {
        const link = linkMap.get(`${ref.type}:${ref.id}`);
        return link ? [link] : [];
      }),
    ]),
  );

  const groups = new Map<Status, Insight[]>();
  for (const g of STATUS_GROUPS) groups.set(g.value, []);
  for (const i of filtered) groups.get(i.status)?.push(i);

  // Subtitle: non-empty status buckets in lifecycle order over the filtered
  // view (same title-total / subtitle-filtered asymmetry as the other lists).
  const subtitleParts = STATUS_GROUPS.filter(
    (g) => (groups.get(g.value)?.length ?? 0) > 0,
  ).map((g) => `${groups.get(g.value)!.length} ${g.word}`);

  const totalCount = allInsights.length;
  const filteredCount = filtered.length;

  function renderCards(list: Insight[]) {
    return list.map((i) => (
      <InsightCard
        key={i.id}
        patientId={patient.patientId}
        insight={i}
        links={linksByInsight.get(i.id) ?? []}
      />
    ));
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Breadcrumb patientId={id} trail={[{ label: "insights" }]} />

      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold leading-tight">
          <span className="border-b-2 border-destructive pb-1">Insights</span>
          {totalCount > 0 ? (
            <span className="ml-2 text-muted-foreground">· {totalCount}</span>
          ) : null}
        </h1>
        {totalCount > 0 ? <InsightFilters /> : null}
      </div>

      {subtitleParts.length > 0 ? (
        <p className="mb-6 text-sm text-muted-foreground">
          {subtitleParts.join(" · ")}
        </p>
      ) : (
        <div className="mb-6" />
      )}

      {totalCount === 0 ? (
        <InsightEmptyState />
      ) : filteredCount === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
          No insights match these filters.
        </p>
      ) : (
        <EntityListSections
          idPrefix="insights"
          sections={STATUS_GROUPS.map((g) => ({
            slug: g.slug,
            label: g.label,
            count: groups.get(g.value)?.length ?? 0,
            defaultOpen: g.defaultOpen,
            cards: renderCards(groups.get(g.value) ?? []),
          }))}
        />
      )}

      <AskAiButton surface={{ key: "insights-list" }} />
    </main>
  );
}
