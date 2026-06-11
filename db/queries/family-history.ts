import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  familyHistory,
  type FamilyHistoryEntry,
  type NewFamilyHistoryEntry,
} from "@/db/schema";
import { familyHistorySlug } from "@/lib/agents/_shared/serializers/family-history";

// Simplest query layer of the state entities: no paired changes table
// (§4:558 — entries are inline-edited in place), no cross-entity FK targets to
// scope-check (no doctor/visit refs), no domain state machine. Plain
// patient-scoped CRUD; no FamilyHistoryDomainError class is needed.

type FamilyHistoryUpdate = Partial<
  Pick<
    NewFamilyHistoryEntry,
    | "relation"
    | "relationSpecific"
    | "conditionName"
    | "ageOfOnset"
    | "outcome"
    | "notes"
  >
>;

export const familyHistoryQueries = {
  async forPatient(patientId: string): Promise<FamilyHistoryEntry[]> {
    return db
      .select()
      .from(familyHistory)
      .where(eq(familyHistory.patientId, patientId))
      .orderBy(desc(familyHistory.createdAt));
  },

  async getById(
    patientId: string,
    id: string,
  ): Promise<FamilyHistoryEntry | null> {
    const rows = await db
      .select()
      .from(familyHistory)
      .where(
        and(eq(familyHistory.id, id), eq(familyHistory.patientId, patientId)),
      )
      .limit(1);
    return rows[0] ?? null;
  },

  // Resolves a citation-pill slug back to an entry, for the chat popover.
  // The serializer's slug is slugify(`${relation}-${conditionName}`) — compound,
  // unlike the single-field slugs elsewhere — so this reuses familyHistorySlug()
  // itself (stripping the `family-history:` prefix it embeds) rather than
  // re-deriving the construction. Same round-trip + collision-suffix limitation
  // as the other bySlug resolvers.
  async bySlug(
    patientId: string,
    slug: string,
  ): Promise<FamilyHistoryEntry | null> {
    const rows = await familyHistoryQueries.forPatient(patientId);
    return (
      rows.find((e) => familyHistorySlug(e) === `family-history:${slug}`) ??
      null
    );
  },

  async create(values: NewFamilyHistoryEntry): Promise<FamilyHistoryEntry> {
    const [row] = await db.insert(familyHistory).values(values).returning();
    return row;
  },

  async update(
    patientId: string,
    id: string,
    values: FamilyHistoryUpdate,
  ): Promise<FamilyHistoryEntry | null> {
    const [row] = await db
      .update(familyHistory)
      .set(values)
      .where(
        and(eq(familyHistory.id, id), eq(familyHistory.patientId, patientId)),
      )
      .returning();
    return row ?? null;
  },

  async delete(patientId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(familyHistory)
      .where(
        and(eq(familyHistory.id, id), eq(familyHistory.patientId, patientId)),
      )
      .returning({ id: familyHistory.id });
    return result.length > 0;
  },
};
