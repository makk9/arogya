import "server-only";

import { entityRefsInScope } from "@/db/queries/entity-links";
import { insightQueries } from "@/db/queries/insight";
import { insightRunQueries } from "@/db/queries/insight-run";
import type { InsightEntityRef, NewInsight } from "@/db/schema";
import { AgentError } from "@/lib/agents/_shared/errors";
import {
  INSIGHT_MODEL_VERSION,
  runInsightGenerator,
} from "@/lib/agents/insight-generator";
import { errorCode, logger } from "@/lib/logger";

// §9.3: skip if a run started for this patient in the last 30 seconds.
const DEBOUNCE_MS = 30_000;
// A `running` row older than this is a crashed/killed process, not a live run —
// without the cutoff one dead run would block generation forever.
const STALE_RUNNING_MS = 5 * 60_000;
// Belt-and-suspenders for the prompt's "at most 2-3 per run" restraint charter.
const MAX_INSIGHTS_PER_RUN = 3;

// The model reasons over vault slugs (`med:...`, `lab-report:...`) but may
// slip into schema-table vocabulary. Normalize to the canonical ref types used
// by entityRefsInScope / resolveEntityRefs before validating.
const REF_TYPE_ALIASES: Record<string, string> = {
  medication: "med",
  lab_report: "lab-report",
  vital_reading: "vital",
  symptom_episode: "symptom-episode",
  symptom_type: "symptom",
  "journal-entry": "journal",
  journal_entry: "journal",
  family_history: "family-history",
};

function normalizeRefType(type: string): string {
  return REF_TYPE_ALIASES[type] ?? type;
}

export interface InsightGenerationResult {
  ran: boolean;
  generatedCount: number;
}

/**
 * Debounced entry point for insight generation (§5.6 / §9.3). Called
 * fire-and-forget after significant entity creations — never awaited on a
 * user-facing path, never throws (failures are recorded on the run row and
 * logged). Deliberately free of `next/server` imports so smoke scripts can
 * call it directly; the `after()` wrapper lives in lib/insights/schedule.ts.
 */
export async function maybeRunInsightGeneration(params: {
  patientId: string;
  trigger: InsightEntityRef;
  now?: Date;
}): Promise<InsightGenerationResult> {
  const { patientId, trigger } = params;
  const now = params.now ?? new Date();

  // Debounce + concurrency guard off the latest run row. Empty runs are rows
  // too — that's the whole reason insight_runs exists.
  const latest = await insightRunQueries.getLatest(patientId);
  if (latest) {
    const age = now.getTime() - latest.startedAt.getTime();
    const debounced = age < DEBOUNCE_MS;
    const liveConcurrent = latest.status === "running" && age < STALE_RUNNING_MS;
    if (debounced || liveConcurrent) {
      return { ran: false, generatedCount: 0 };
    }
  }

  const run = await insightRunQueries.create({
    patientId,
    trigger,
    modelVersion: INSIGHT_MODEL_VERSION,
  });

  try {
    const generated = await runInsightGenerator({ patientId, trigger, now });

    // Normalize the model's type vocabulary, then validate every ref against
    // the patient's vault — fabricated/garbled ids are dropped, and an insight
    // with no surviving evidence is dropped whole (§5.6 never-invent).
    const normalized = generated.map((g) => ({
      ...g,
      cited_sources: g.cited_sources.map((s) => ({
        ...s,
        type: normalizeRefType(s.type),
      })),
      linked_entities: (g.linked_entities ?? []).map((l) => ({
        ...l,
        type: normalizeRefType(l.type),
      })),
    }));

    const allRefs = normalized.flatMap((g) => [
      ...g.cited_sources,
      ...g.linked_entities,
    ]);
    const inScope = await entityRefsInScope(patientId, allRefs);
    const keyOf = (r: { type: string; id: string }) => `${r.type}:${r.id}`;

    const withValidRefs = normalized
      .map((g) => ({
        ...g,
        cited_sources: g.cited_sources.filter((s) => inScope.has(keyOf(s))),
        linked_entities: g.linked_entities.filter((l) => inScope.has(keyOf(l))),
      }))
      .filter((g) => g.cited_sources.length > 0);

    // Distinguish "the model held back" (genuine restraint, the common case)
    // from "everything it emitted was discarded for fabricated refs" — the two
    // are identical in the feed but mean opposite things when debugging. The
    // restraint cap below is deliberately NOT counted here.
    const droppedForRefs = normalized.length - withValidRefs.length;
    if (droppedForRefs > 0) {
      logger.warn({
        op: "insights.generate",
        code: `dropped_invalid_refs_${droppedForRefs}`,
        ids: { patientId, runId: run.id },
      });
    }

    const rows: NewInsight[] = withValidRefs
      .slice(0, MAX_INSIGHTS_PER_RUN)
      .map((g) => ({
        patientId,
        title: g.title,
        body: g.body,
        category: g.category,
        severity: g.severity,
        // Server-stamped — the agent-output schema deliberately omits it.
        triggeredBy: trigger,
        citedSources: g.cited_sources,
        linkedEntities: g.linked_entities.length > 0 ? g.linked_entities : null,
        // v1: never persist model-emitted external refs (decisions.md 2026-07-20).
        externalRefs: null,
        modelVersion: INSIGHT_MODEL_VERSION,
      }));

    const inserted = await insightQueries.createMany(rows);

    await insightRunQueries.finish(run.id, {
      status: "succeeded",
      generatedCount: inserted.length,
    });
    logger.info({
      op: "insights.generate",
      code: `generated_${inserted.length}`,
      ids: { patientId, runId: run.id },
    });
    return { ran: true, generatedCount: inserted.length };
  } catch (err) {
    await insightRunQueries
      .finish(run.id, {
        status: "failed",
        generatedCount: 0,
        errorCode: err instanceof AgentError ? err.code : errorCode(err),
      })
      .catch(() => {
        // The run row stays `running` and ages into the stale cutoff.
      });
    logger.error({
      op: "insights.generate",
      code: err instanceof AgentError ? err.code : errorCode(err),
      ids: { patientId, runId: run.id },
    });
    return { ran: true, generatedCount: 0 };
  }
}
