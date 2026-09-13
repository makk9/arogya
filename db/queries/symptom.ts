import { and, desc, eq, inArray, ne } from "drizzle-orm";

import { db } from "@/db";
import {
  symptomEpisodes,
  symptomTypes,
  vitalReadings,
  type NewSymptomEpisode,
  type NewSymptomType,
  type SymptomEpisode,
  type SymptomType,
} from "@/db/schema";
import { slugify } from "@/lib/agents/_shared/serializers/format";
import { dateInTimezone } from "@/lib/datetime";
import { conditionInScope, symptomTypeInScope, visitInScope } from "./_shared";

/*
 * Symptom queries — the third EVENT entity (§6.6/§6.7) and the second one→many
 * split, but INVERTED from labs: here the CHILD (SymptomEpisode) is the event
 * with its own timeline card + detail page, while the PARENT (SymptomType) is
 * the stable identity that groups the timeline and carries the editable
 * status / linked-condition / notes. The type therefore gets a state-style
 * detail page (the parent-link target, §6.7:1509) — an addition beyond the
 * 6.6/6.7 wireframes, signed off 2026-06-16 (decisions.md).
 *
 * Patient scope rides patient_id on both tables (denormalized onto episodes for
 * fast time-window queries, §4:458), so a foreign id can never surface another
 * patient's rows. Cross-entity FK targets (linked_condition, linked_visit_id,
 * linked_vital_ids) are scope-checked before write — a mapped 400, not a
 * Postgres FK-violation 500.
 */

// Type-level columns editable via PATCH (§6.7 Edit / state-detail inline edit).
// `name` is the identity (non-nullable); the rest clear to null.
type SymptomTypeUpdate = Partial<
  Pick<
    NewSymptomType,
    "name" | "bodyArea" | "linkedCondition" | "firstNoted" | "status" | "notes"
  >
>;

// Episode-level columns editable via PATCH. symptom_type_id is NOT here — an
// episode belongs to its type for life (reassigning would orphan the grouping).
// linked_vital_ids IS editable post-hoc (replace-whole-array) — the manual
// "link a reading after the fact" workflow on the episode detail.
type SymptomEpisodeUpdate = Partial<
  Pick<
    NewSymptomEpisode,
    | "startedAt"
    | "endedAt"
    | "durationMinutes"
    | "severity"
    | "description"
    | "triggers"
    | "relief"
    | "linkedVitalIds"
    | "linkedVisitId"
    | "notes"
  >
>;

// Episode fields as they arrive from the create form, before patient_id and the
// resolved symptom_type_id are stamped on.
export interface NewEpisodeInput {
  startedAt: Date;
  endedAt?: Date | null;
  durationMinutes?: number | null;
  severity?: SymptomEpisode["severity"];
  description?: string | null;
  triggers?: string | null;
  relief?: string | null;
  linkedVitalIds?: string[] | null;
  linkedVisitId?: string | null;
  notes?: string | null;
  // Set by the E3 extraction commit (§5.4) so a committed episode backlinks to
  // its source Report; null for direct entry. `recorded_by` is likewise set by
  // extraction/auth callers — direct-entry routes leave it to the DB.
  sourceReportId?: string | null;
  recordedBy?: string | null;
}

// How an episode resolves its parent type: an existing type, or a new one
// created inline ("+ Create new" on the §6.12 autocomplete).
export type EpisodeTypeRef =
  | { kind: "existing"; symptomTypeId: string }
  | { kind: "new"; name: string; bodyArea?: SymptomType["bodyArea"] };

// Domain error kinds:
//  - not_found             — patient-scoped lookup missed
//  - linked_entity_invalid — symptomTypeId / linkedVisitId / a linkedVitalId /
//                            linkedCondition out of patient scope (reason:
//                            symptom_type_not_found / visit_not_found /
//                            vital_not_found / condition_not_found)
//  - invalid_time_range    — a PATCH would leave ended_at before started_at
export class SymptomDomainError extends Error {
  constructor(
    public readonly kind: "not_found" | "linked_entity_invalid" | "invalid_time_range",
    public readonly meta?: { field?: string; reason?: string },
  ) {
    super(kind);
    this.name = "SymptomDomainError";
  }
}

// All vital ids in scope? Dedupes first so a repeated id can't inflate the count
// past the row total. Returns false on the first miss.
async function vitalsInScope(
  patientId: string,
  ids: readonly string[],
): Promise<boolean> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return true;
  const rows = await db
    .select({ id: vitalReadings.id })
    .from(vitalReadings)
    .where(
      and(eq(vitalReadings.patientId, patientId), inArray(vitalReadings.id, unique)),
    );
  return rows.length === unique.length;
}

async function assertConditionInScope(
  patientId: string,
  linkedCondition: string | null | undefined,
): Promise<void> {
  if (linkedCondition && !(await conditionInScope(patientId, linkedCondition))) {
    throw new SymptomDomainError("linked_entity_invalid", {
      field: "linkedCondition",
      reason: "condition_not_found",
    });
  }
}

export const symptomTypeQueries = {
  // Stable order for the timeline: by status precedence (active → monitoring →
  // resolved is applied in the page), here just newest-first as a base sort.
  async forPatient(patientId: string): Promise<SymptomType[]> {
    return db
      .select()
      .from(symptomTypes)
      .where(eq(symptomTypes.patientId, patientId))
      .orderBy(desc(symptomTypes.createdAt));
  },

  async getById(patientId: string, id: string): Promise<SymptomType | null> {
    const rows = await db
      .select()
      .from(symptomTypes)
      .where(and(eq(symptomTypes.id, id), eq(symptomTypes.patientId, patientId)))
      .limit(1);
    return rows[0] ?? null;
  },

  // Resolves a `§ symptom:<slug>` citation. The serializer's symptomTypeSlug is
  // slugify(name), so we match on the slugified name (round-trip, like the other
  // bySlug helpers). Two types slugifying alike resolve to the first — accepted
  // for v1 (names are distinct in practice).
  async bySlug(patientId: string, slug: string): Promise<SymptomType | null> {
    const rows = await symptomTypeQueries.forPatient(patientId);
    return rows.find((t) => slugify(t.name) === slug) ?? null;
  },

  async update(
    patientId: string,
    id: string,
    values: SymptomTypeUpdate,
  ): Promise<SymptomType | null> {
    await assertConditionInScope(patientId, values.linkedCondition);
    const [row] = await db
      .update(symptomTypes)
      .set(values)
      .where(and(eq(symptomTypes.id, id), eq(symptomTypes.patientId, patientId)))
      .returning();
    return row ?? null;
  },

  // symptom_episodes.symptom_type_id is onDelete:"cascade" — deleting a type
  // removes its whole episode stream. The actions menu warns with the count.
  async delete(patientId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(symptomTypes)
      .where(and(eq(symptomTypes.id, id), eq(symptomTypes.patientId, patientId)))
      .returning({ id: symptomTypes.id });
    return result.length > 0;
  },
};

export const symptomEpisodeQueries = {
  // Whole patient stream, newest first — the page groups by type.
  async forPatient(patientId: string): Promise<SymptomEpisode[]> {
    return db
      .select()
      .from(symptomEpisodes)
      .where(eq(symptomEpisodes.patientId, patientId))
      .orderBy(desc(symptomEpisodes.startedAt), desc(symptomEpisodes.createdAt));
  },

  // One type's episodes — the SymptomType detail page's episode stream.
  async forType(patientId: string, symptomTypeId: string): Promise<SymptomEpisode[]> {
    return db
      .select()
      .from(symptomEpisodes)
      .where(
        and(
          eq(symptomEpisodes.patientId, patientId),
          eq(symptomEpisodes.symptomTypeId, symptomTypeId),
        ),
      )
      .orderBy(desc(symptomEpisodes.startedAt), desc(symptomEpisodes.createdAt));
  },

  async getById(patientId: string, id: string): Promise<SymptomEpisode | null> {
    const rows = await db
      .select()
      .from(symptomEpisodes)
      .where(and(eq(symptomEpisodes.id, id), eq(symptomEpisodes.patientId, patientId)))
      .limit(1);
    return rows[0] ?? null;
  },

  // Resolves a `§ symptom-episode:<date>` citation. The serializer's
  // symptomEpisodeSlug is the ISO start date, so the bare slug IS the date —
  // matched by construction round-trip (same same-day collision limit as visit).
  async bySlug(patientId: string, slug: string): Promise<SymptomEpisode | null> {
    const rows = await symptomEpisodeQueries.forPatient(patientId);
    return (
      rows.find((e) => e.startedAt.toISOString().slice(0, 10) === slug) ?? null
    );
  },

  // §6.7 Linked context "related episodes nearby in time" — same-type siblings,
  // excluding this episode, ordered newest-first (proximity in the page).
  // Deliberately unbounded: the page renders the first 5 but shows the FULL
  // sibling count ("Other dizziness episodes · N"), so a LIMIT would under-report
  // the total. Trivial at single-patient scale; revisit (count query + limited
  // rows) only if a single symptom ever accumulates hundreds of episodes.
  async siblings(
    patientId: string,
    symptomTypeId: string,
    excludeId: string,
  ): Promise<SymptomEpisode[]> {
    return db
      .select()
      .from(symptomEpisodes)
      .where(
        and(
          eq(symptomEpisodes.patientId, patientId),
          eq(symptomEpisodes.symptomTypeId, symptomTypeId),
          ne(symptomEpisodes.id, excludeId),
        ),
      )
      .orderBy(desc(symptomEpisodes.startedAt), desc(symptomEpisodes.createdAt));
  },

  // Transactional create: resolves the parent type (existing or new), scope-
  // checks every cross-entity ref, then inserts the episode. When the type is
  // new its first_noted seeds from the episode's start date (§4:448 — "when this
  // symptom first appeared"). Returns the episode plus the resolved type id and
  // whether a type was created (the route uses neither downstream today, but the
  // shape leaves room for a "created Dizziness" confirmation).
  async create(
    patientId: string,
    typeRef: EpisodeTypeRef,
    episode: NewEpisodeInput,
    // Patient's IANA timezone — a new type's first_noted is the episode's
    // calendar day in the patient's zone, not the UTC day (a 03:00 IST episode
    // is the previous day in UTC).
    timezone: string,
  ): Promise<{ episode: SymptomEpisode; symptomTypeId: string; createdType: boolean }> {
    if (
      typeRef.kind === "existing" &&
      !(await symptomTypeInScope(patientId, typeRef.symptomTypeId))
    ) {
      throw new SymptomDomainError("linked_entity_invalid", {
        field: "symptomTypeId",
        reason: "symptom_type_not_found",
      });
    }
    if (episode.linkedVisitId && !(await visitInScope(patientId, episode.linkedVisitId))) {
      throw new SymptomDomainError("linked_entity_invalid", {
        field: "linkedVisitId",
        reason: "visit_not_found",
      });
    }
    if (
      episode.linkedVitalIds &&
      episode.linkedVitalIds.length > 0 &&
      !(await vitalsInScope(patientId, episode.linkedVitalIds))
    ) {
      throw new SymptomDomainError("linked_entity_invalid", {
        field: "linkedVitalIds",
        reason: "vital_not_found",
      });
    }

    return db.transaction(async (tx) => {
      let symptomTypeId: string;
      let createdType = false;
      if (typeRef.kind === "existing") {
        symptomTypeId = typeRef.symptomTypeId;
      } else {
        const firstNoted = dateInTimezone(episode.startedAt, timezone);
        const [type] = await tx
          .insert(symptomTypes)
          .values({
            patientId,
            name: typeRef.name,
            bodyArea: typeRef.bodyArea ?? null,
            firstNoted,
          })
          .returning();
        symptomTypeId = type.id;
        createdType = true;
      }

      const [row] = await tx
        .insert(symptomEpisodes)
        .values({
          symptomTypeId,
          patientId,
          startedAt: episode.startedAt,
          endedAt: episode.endedAt ?? null,
          durationMinutes: episode.durationMinutes ?? null,
          severity: episode.severity ?? null,
          description: episode.description ?? null,
          triggers: episode.triggers ?? null,
          relief: episode.relief ?? null,
          linkedVitalIds: episode.linkedVitalIds ?? null,
          linkedVisitId: episode.linkedVisitId ?? null,
          notes: episode.notes ?? null,
          sourceReportId: episode.sourceReportId ?? null,
          ...(episode.recordedBy ? { recordedBy: episode.recordedBy } : {}),
        })
        .returning();

      return { episode: row, symptomTypeId, createdType };
    });
  },

  async update(
    patientId: string,
    id: string,
    values: SymptomEpisodeUpdate,
  ): Promise<SymptomEpisode | null> {
    if (values.linkedVisitId && !(await visitInScope(patientId, values.linkedVisitId))) {
      throw new SymptomDomainError("linked_entity_invalid", {
        field: "linkedVisitId",
        reason: "visit_not_found",
      });
    }
    if (
      values.linkedVitalIds &&
      values.linkedVitalIds.length > 0 &&
      !(await vitalsInScope(patientId, values.linkedVitalIds))
    ) {
      throw new SymptomDomainError("linked_entity_invalid", {
        field: "linkedVitalIds",
        reason: "vital_not_found",
      });
    }
    // A partial PATCH can move either end, so check the span against the stored
    // row — the create schema's refine only sees both ends at create time.
    if (values.startedAt !== undefined || values.endedAt !== undefined) {
      const current = await symptomEpisodeQueries.getById(patientId, id);
      if (!current) return null;
      const start = values.startedAt ?? current.startedAt;
      const end = values.endedAt !== undefined ? values.endedAt : current.endedAt;
      if (start && end && end.getTime() < start.getTime()) {
        throw new SymptomDomainError("invalid_time_range", { field: "endedAt" });
      }
    }
    const [row] = await db
      .update(symptomEpisodes)
      .set(values)
      .where(and(eq(symptomEpisodes.id, id), eq(symptomEpisodes.patientId, patientId)))
      .returning();
    return row ?? null;
  },

  async delete(patientId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(symptomEpisodes)
      .where(and(eq(symptomEpisodes.id, id), eq(symptomEpisodes.patientId, patientId)))
      .returning({ id: symptomEpisodes.id });
    return result.length > 0;
  },
};

