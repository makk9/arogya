import { and, desc, eq, inArray, ne } from "drizzle-orm";

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
  type JournalEntry,
  type JournalLinkedEntity,
  type NewJournalEntry,
} from "@/db/schema";
import { formatISODate } from "@/lib/agents/_shared/serializers/format";
import { formatAbsoluteDate } from "@/lib/datetime";
import { displayDoctorName } from "@/lib/doctor-display";

// Columns editable via PATCH. No change-log split — JournalEntry is an event
// entity (§6.7: no History; Edit corrects the row in place). No FK columns to
// scope-check (a journal entry references nothing structural).
type JournalUpdate = Partial<
  Pick<NewJournalEntry, "entryDate" | "title" | "content" | "mood">
>;

/**
 * A `linked_entities` ref (§4:506 jsonb `{type,id}`) resolved to a navigable
 * pill — label + detail href. Refs are AI-tagged at write time (§6.12:1862,
 * Phase E), so this returns `[]` for every manually-entered entry until then.
 */
export interface ResolvedJournalLink {
  type: string;
  id: string;
  label: string;
  href: string;
}

// Per-type resolution of a batch of ids → id → {label, href}. One query per
// distinct type present in the refs (not per ref). Types without a detail page
// (vital) are unhandled and silently dropped — the same posture as the
// serializer filtering unresolved citations. Every select is patient-scoped, so
// a foreign id can't surface another patient's row.
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
    // `vital` and any unknown type have no detail page → unresolved → dropped.
  }
  return out;
}

export const journalQueries = {
  // entryDate desc with createdAt tiebreaker — two same-day entries render in
  // reverse write order, matching the timeline convention.
  async forPatient(patientId: string): Promise<JournalEntry[]> {
    return db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.patientId, patientId))
      .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt));
  },

  async getById(patientId: string, id: string): Promise<JournalEntry | null> {
    const rows = await db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.id, id), eq(journalEntries.patientId, patientId)))
      .limit(1);
    return rows[0] ?? null;
  },

  // Resolves a citation-pill slug back to an entry. The serializer's
  // journalEntrySlug is the ISO entry date (`journal:2026-04-12`), so the bare
  // slug IS the date — same construction-round-trip + collision-suffix limit as
  // the other event bySlug helpers (a 2nd same-day entry cites null).
  async bySlug(patientId: string, slug: string): Promise<JournalEntry | null> {
    const rows = await journalQueries.forPatient(patientId);
    return rows.find((e) => formatISODate(e.entryDate) === slug) ?? null;
  },

  async create(values: NewJournalEntry): Promise<JournalEntry> {
    const [row] = await db.insert(journalEntries).values(values).returning();
    return row;
  },

  async update(
    patientId: string,
    id: string,
    values: JournalUpdate,
  ): Promise<JournalEntry | null> {
    const [row] = await db
      .update(journalEntries)
      .set(values)
      .where(and(eq(journalEntries.id, id), eq(journalEntries.patientId, patientId)))
      .returning();
    return row ?? null;
  },

  async delete(patientId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(journalEntries)
      .where(and(eq(journalEntries.id, id), eq(journalEntries.patientId, patientId)))
      .returning({ id: journalEntries.id });
    return result.length > 0;
  },

  // §6.7:1535 "OTHER JOURNAL ENTRIES FROM THIS MONTH" — sibling entries sharing
  // the entry's YYYY-MM, excluding itself, newest first. Filtered in-process
  // over the patient's set (single-patient scale; same approach as the symptom
  // siblings).
  async siblingsThisMonth(
    patientId: string,
    entry: JournalEntry,
  ): Promise<JournalEntry[]> {
    const month = entry.entryDate.slice(0, 7);
    const rows = await db
      .select()
      .from(journalEntries)
      .where(
        and(eq(journalEntries.patientId, patientId), ne(journalEntries.id, entry.id)),
      )
      .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt));
    return rows.filter((e) => e.entryDate.slice(0, 7) === month);
  },

  // §6.6:1470 / §6.7:1535 — resolves the `linked_entities` jsonb refs to
  // navigable pills. Empty for manual entries until the Phase E tagging path
  // populates the refs. Preserves ref order; drops anything unresolvable (a
  // deleted entity, or a type with no detail page).
  async resolveLinkedEntities(
    patientId: string,
    refs: JournalLinkedEntity[] | null | undefined,
  ): Promise<ResolvedJournalLink[]> {
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
  },
};
