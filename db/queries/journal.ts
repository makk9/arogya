import { and, desc, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import {
  journalEntries,
  type JournalEntry,
  type JournalLinkedEntity,
  type NewJournalEntry,
} from "@/db/schema";
import {
  resolveEntityRefs,
  type ResolvedEntityLink,
} from "@/db/queries/entity-links";
import { formatISODate } from "@/lib/agents/_shared/serializers/format";

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
 *
 * The per-type resolution itself lives in `db/queries/entity-links.ts` (shared
 * with Insights); this is a structural alias kept so the journal components'
 * `ResolvedJournalLink` imports stay valid.
 */
export type ResolvedJournalLink = ResolvedEntityLink;

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
    return resolveEntityRefs(patientId, refs);
  },
};
