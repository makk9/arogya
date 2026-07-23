import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { AskAiButton } from "@/components/ask-ai-button";
import { Breadcrumb } from "@/components/breadcrumb";
import { InsightBody } from "@/components/insights/insight-body";
import { InsightCitedSourcesSection } from "@/components/insights/insight-cited-sources-section";
import {
  InsightLinkedContextSection,
  type OtherPatternGroup,
} from "@/components/insights/insight-linked-context-section";
import { InsightNotesSection } from "@/components/insights/insight-notes-section";
import { InsightStatusActions } from "@/components/insights/insight-status-actions";
import { CATEGORY_LABEL } from "@/components/insights/insight-options";
import {
  resolveEntityHrefs,
  resolveEntityRefs,
} from "@/db/queries/entity-links";
import { insightQueries } from "@/db/queries/insight";
import { getCurrentPatient } from "@/lib/auth";
import { insightSurfaceContext } from "@/lib/chat/surface-context";
import { formatAbsoluteDate } from "@/lib/datetime";

/*
 * Insight detail per §6.9 — the canonical view of one insight. Read-only except
 * the status lifecycle (the action buttons); the insight body itself is
 * immutable AI output (§4:591), so there is no edit mode or form here.
 *
 * Section order (§6.9:1608, all five): Header → Body → Cited sources → Linked
 * context → Notes. The body + citations are immutable AI output; Notes is the
 * one editable section (`insights.notes`, inline-edited — §6.9:1629).
 *
 * Backlinks (Linked context) are derived at render time, never stored (Phase 3
 * tripwire). Constrained ~720px document width (§6.9:1609).
 */

const insightIdParam = z.string().uuid();

export default async function InsightDetailPage({
  params,
}: {
  params: Promise<{ id: string; insightId: string }>;
}) {
  const { id, insightId: rawInsightId } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  const idCheck = insightIdParam.safeParse(rawInsightId);
  if (!idCheck.success) notFound();

  const insight = await insightQueries.getById(patient.patientId, idCheck.data);
  if (!insight) notFound();

  // §6.9:1610 — the triggered-by event always surfaces in the subtitle. Every
  // trigger type resolves through resolveEntityRefs now that `vital` targets
  // the grouped history view's row anchor (E0a, decisions.md 2026-07-21) — the
  // old inert-vital fallback fetch is gone with it. A null here means the
  // triggering entity was deleted; the subtitle just omits the clause.
  const [triggeredLinks, citedHrefs, headlineLinks, allInsights] =
    await Promise.all([
      resolveEntityRefs(patient.patientId, [insight.triggeredBy]),
      resolveEntityHrefs(patient.patientId, insight.citedSources),
      resolveEntityRefs(patient.patientId, insight.linkedEntities),
      insightQueries.forPatient(patient.patientId),
    ]);

  const triggered = triggeredLinks[0] ?? null;
  const categoryLabel = CATEGORY_LABEL[insight.category] ?? insight.category;

  // OTHER PATTERNS WITH [ENTITY]: other insights that share one of this
  // insight's headline entities (via their linked_entities or cited_sources).
  // Derived live — backlinks are never stored. This scans the patient's full
  // insight set in memory (the `forPatient` load above); bounded by §5.6's
  // deliberately low insight volume ("two useful insights per month"), so the
  // O(insights × headline refs) pass is cheap. Revisit if that ceiling moves.
  const others = allInsights.filter((i) => i.id !== insight.id);
  const otherPatterns: OtherPatternGroup[] = headlineLinks
    .map((link) => {
      const key = `${link.type}:${link.id}`;
      const matching = others
        .filter(
          (o) =>
            (o.linkedEntities ?? []).some((e) => `${e.type}:${e.id}` === key) ||
            (o.citedSources ?? []).some((s) => `${s.type}:${s.id}` === key),
        )
        .map((o) => ({ id: o.id, title: o.title }));
      return { entityLabel: link.label, insights: matching };
    })
    .filter((g) => g.insights.length > 0);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Breadcrumb patientId={id} trail={[{ label: "insights", href: "insights" }, { label: `${insight.id.slice(0, 8)}…` }]} />

      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="min-w-0 flex-1 font-heading text-2xl font-semibold leading-tight">
          <span className="border-b-2 border-destructive pb-1">
            {insight.title}
          </span>
        </h1>
        <InsightStatusActions insightId={insight.id} status={insight.status} />
      </div>

      <p className="mb-8 text-sm text-muted-foreground">
        generated {formatAbsoluteDate(insight.generatedAt)}
        {triggered ? (
          <>
            {" · triggered by "}
            <Link
              href={triggered.href}
              className="border-b border-destructive/60 pb-px text-foreground hover:border-destructive"
            >
              {triggered.label}
            </Link>
          </>
        ) : null}
        {" · category: "}
        {categoryLabel}
      </p>

      {/* Document column, constrained per §6.9:1609 (~720–800px). max-w-3xl
          inside the px-6 main resolves to ~720px. */}
      <div className="max-w-3xl">
        <section className="mb-8">
          <InsightBody markdown={insight.body} />
        </section>

        <InsightCitedSourcesSection
          sources={insight.citedSources}
          hrefByKey={citedHrefs}
        />

        <InsightLinkedContextSection
          patientId={patient.patientId}
          groups={otherPatterns}
        />

        <InsightNotesSection insightId={insight.id} notes={insight.notes ?? ""} />
      </div>

      <AskAiButton
        surfaceContext={insightSurfaceContext({
          title: insight.title,
          category: insight.category,
          status: insight.status,
        })}
      />
    </main>
  );
}
