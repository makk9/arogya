import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  allergies,
  conditions,
  doctors,
  familyHistory,
  journalEntries,
  labReports,
  medications,
  reports,
  symptomEpisodes,
  symptomTypes,
  visits,
  vitalReadings,
} from "@/db/schema";
import { formatAbsoluteDate } from "@/lib/datetime";
import { displayDoctorName } from "@/lib/doctor-display";
import { formatVitalValue, READING_TYPE_LABEL } from "@/lib/vitals";

/**
 * Shared resolver for polymorphic `{type, id}` entity refs → navigable pills
 * (label + detail href). Both `journal_entries.linked_entities` (§6.6/6.7) and
 * `insights.{linked_entities, cited_sources}` (§6.8/6.9) store the same ref
 * shape, so the per-type id→{label,href} batch logic lives here rather than
 * being copied per consumer (extracted at the second consumer — Insights —
 * mirroring the EntityListSections extraction).
 *
 * Every select is patient-scoped, so a foreign id can't surface another
 * patient's row. `vital` resolves to the grouped history view's row anchor
 * (it has no detail page by design); genuinely unknown types are silently
 * dropped — the same posture as the serializer filtering unresolved
 * citations. Callers that must still *display* an unresolvable ref render
 * from the ref's own snippet and treat a missing href as inert.
 */

export interface ResolvedEntityLink {
  type: string;
  id: string;
  label: string;
  href: string;
}

export interface EntityRef {
  type: string;
  id: string;
}

// Per-type resolution of a batch of ids → id → {label, href}. One query per
// distinct type present in the refs (not per ref).
async function resolveTypeBatch(
  patientId: string,
  type: string,
  ids: string[],
): Promise<Map<string, { label: string; href: string }>> {
  const out = new Map<string, { label: string; href: string }>();
  const base = (p: string) => `/patient/${patientId}/${p}`;

  switch (type) {
    case "med": {
      const rows = await db
        .select({ id: medications.id, name: medications.name })
        .from(medications)
        .where(and(eq(medications.patientId, patientId), inArray(medications.id, ids)));
      for (const r of rows) out.set(r.id, { label: r.name, href: base(`medications/${r.id}`) });
      break;
    }
    case "condition": {
      const rows = await db
        .select({ id: conditions.id, name: conditions.name })
        .from(conditions)
        .where(and(eq(conditions.patientId, patientId), inArray(conditions.id, ids)));
      for (const r of rows) out.set(r.id, { label: r.name, href: base(`conditions/${r.id}`) });
      break;
    }
    case "doctor": {
      const rows = await db
        .select({ id: doctors.id, name: doctors.name })
        .from(doctors)
        .where(and(eq(doctors.patientId, patientId), inArray(doctors.id, ids)));
      for (const r of rows)
        out.set(r.id, { label: displayDoctorName(r.name), href: base(`doctors/${r.id}`) });
      break;
    }
    case "allergy": {
      const rows = await db
        .select({ id: allergies.id, substance: allergies.substance })
        .from(allergies)
        .where(and(eq(allergies.patientId, patientId), inArray(allergies.id, ids)));
      for (const r of rows)
        out.set(r.id, { label: r.substance, href: base(`allergies/${r.id}`) });
      break;
    }
    case "visit": {
      const rows = await db
        .select({ id: visits.id, visitDate: visits.visitDate })
        .from(visits)
        .where(and(eq(visits.patientId, patientId), inArray(visits.id, ids)));
      for (const r of rows)
        out.set(r.id, {
          label: `Visit · ${formatAbsoluteDate(r.visitDate)}`,
          href: base(`visits/${r.id}`),
        });
      break;
    }
    case "lab-report": {
      const rows = await db
        .select({ id: labReports.id, reportType: labReports.reportType, labName: labReports.labName })
        .from(labReports)
        .where(and(eq(labReports.patientId, patientId), inArray(labReports.id, ids)));
      for (const r of rows)
        out.set(r.id, {
          label: r.reportType ?? r.labName ?? "Lab report",
          href: base(`labs/${r.id}`),
        });
      break;
    }
    case "report": {
      const rows = await db
        .select({ id: reports.id, title: reports.title })
        .from(reports)
        .where(and(eq(reports.patientId, patientId), inArray(reports.id, ids)));
      for (const r of rows) out.set(r.id, { label: r.title, href: base(`reports/${r.id}`) });
      break;
    }
    case "symptom": {
      const rows = await db
        .select({ id: symptomTypes.id, name: symptomTypes.name })
        .from(symptomTypes)
        .where(and(eq(symptomTypes.patientId, patientId), inArray(symptomTypes.id, ids)));
      for (const r of rows)
        out.set(r.id, { label: r.name, href: base(`symptoms/types/${r.id}`) });
      break;
    }
    case "symptom-episode": {
      const rows = await db
        .select({ id: symptomEpisodes.id, startedAt: symptomEpisodes.startedAt })
        .from(symptomEpisodes)
        .where(and(eq(symptomEpisodes.patientId, patientId), inArray(symptomEpisodes.id, ids)));
      for (const r of rows)
        out.set(r.id, {
          label: `Episode · ${formatAbsoluteDate(r.startedAt)}`,
          href: base(`symptoms/${r.id}`),
        });
      break;
    }
    case "family-history": {
      const rows = await db
        .select({ id: familyHistory.id, conditionName: familyHistory.conditionName })
        .from(familyHistory)
        .where(and(eq(familyHistory.patientId, patientId), inArray(familyHistory.id, ids)));
      for (const r of rows)
        out.set(r.id, { label: r.conditionName, href: base(`family-history/${r.id}`) });
      break;
    }
    case "vital": {
      // Vitals have no detail page by design (§3:145 "the trend is the value");
      // the ref resolves to the grouped history view, anchored to the reading's
      // table row (decisions.md 2026-07-21 — this is what makes insight
      // cited-source vitals and symptom-linked readings clickable).
      const rows = await db
        .select()
        .from(vitalReadings)
        .where(and(eq(vitalReadings.patientId, patientId), inArray(vitalReadings.id, ids)));
      for (const r of rows)
        out.set(r.id, {
          label: `${READING_TYPE_LABEL[r.readingType]} ${formatVitalValue(r)} · ${formatAbsoluteDate(r.recordedAt)}`,
          href: base(`vitals#r-${r.id}`),
        });
      break;
    }
    // Any unknown type has no detail page → unresolved → dropped.
  }
  return out;
}

/**
 * Resolve a batch of polymorphic refs to navigable pills, preserving ref order
 * and dropping anything unresolvable (a deleted entity, or a type with no
 * detail page). One query per distinct type.
 */
export async function resolveEntityRefs(
  patientId: string,
  refs: EntityRef[] | null | undefined,
): Promise<ResolvedEntityLink[]> {
  if (!refs || refs.length === 0) return [];

  const idsByType = new Map<string, string[]>();
  for (const ref of refs) {
    const arr = idsByType.get(ref.type) ?? [];
    arr.push(ref.id);
    idsByType.set(ref.type, arr);
  }

  const resolved = new Map<string, { label: string; href: string }>();
  await Promise.all(
    [...idsByType].map(async ([type, ids]) => {
      const batch = await resolveTypeBatch(patientId, type, ids);
      for (const [id, v] of batch) resolved.set(`${type}:${id}`, v);
    }),
  );

  return refs.flatMap((ref) => {
    const v = resolved.get(`${ref.type}:${ref.id}`);
    return v ? [{ type: ref.type, id: ref.id, label: v.label, href: v.href }] : [];
  });
}

/**
 * Resolve a batch of refs once into a `${type}:${id}` → link map. For callers
 * that resolve a *union* of refs spanning several owners (e.g. the insights
 * feed, where many cards share the same headline entity) and then look each
 * ref up by key — this resolves each distinct entity a single time instead of
 * once per owner. Unresolvable refs are simply absent from the map.
 */
export async function resolveEntityRefMap(
  patientId: string,
  refs: EntityRef[] | null | undefined,
): Promise<Map<string, ResolvedEntityLink>> {
  const links = await resolveEntityRefs(patientId, refs);
  return new Map(links.map((l) => [`${l.type}:${l.id}`, l]));
}

// Existence-only per-type id checks for `entityRefsInScope`. Superset of
// `resolveTypeBatch`'s types: includes `vital` and `journal`, which have no
// detail page (so no resolvable href) but are perfectly valid evidence for an
// insight citation — without them a vital- or journal-triggered insight would
// lose its own strongest source.
const SCOPE_TABLES = {
  med: medications,
  condition: conditions,
  doctor: doctors,
  allergy: allergies,
  visit: visits,
  "lab-report": labReports,
  report: reports,
  symptom: symptomTypes,
  "symptom-episode": symptomEpisodes,
  "family-history": familyHistory,
  vital: vitalReadings,
  journal: journalEntries,
} as const;

/**
 * Validate a batch of polymorphic refs against the patient's vault: returns
 * the set of `${type}:${id}` keys that exist in scope. One existence query per
 * distinct type. Built for the insight generator's never-fabricate discipline
 * (§5.6) — refs the model garbled or invented simply don't come back.
 */
export async function entityRefsInScope(
  patientId: string,
  refs: EntityRef[],
): Promise<Set<string>> {
  const valid = new Set<string>();
  if (refs.length === 0) return valid;

  const idsByType = new Map<string, string[]>();
  for (const ref of refs) {
    const arr = idsByType.get(ref.type) ?? [];
    arr.push(ref.id);
    idsByType.set(ref.type, arr);
  }

  await Promise.all(
    [...idsByType].map(async ([type, ids]) => {
      const table = SCOPE_TABLES[type as keyof typeof SCOPE_TABLES];
      if (!table) return; // unknown type → all its refs invalid
      const rows = await db
        .select({ id: table.id })
        .from(table)
        .where(and(eq(table.patientId, patientId), inArray(table.id, ids)));
      for (const r of rows) valid.add(`${type}:${r.id}`);
    }),
  );

  return valid;
}

/**
 * Resolve refs to an id→href map (for callers that already hold their own
 * labels — e.g. insight cited-sources, which renders each source's stored
 * `snippet` as the row text and only needs the href to linkify it). Keyed by
 * `${type}:${id}`, matching how callers look the href up per ref.
 */
export async function resolveEntityHrefs(
  patientId: string,
  refs: EntityRef[] | null | undefined,
): Promise<Map<string, string>> {
  const map = await resolveEntityRefMap(patientId, refs);
  return new Map([...map].map(([k, l]) => [k, l.href]));
}
