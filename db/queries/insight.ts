import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { insights, type Insight, type NewInsight } from "@/db/schema";

// The AI-authored fields are immutable (§4:591 "New reasoning produces a new
// Insight row, not an edit"). Two user-facing fields mutate: the status
// lifecycle (§4:583, the detail action buttons §6.9:1607) and the editorial
// `notes` (§6.9:1629). Neither is `*_changes`-logged — they're operational /
// editorial state on a derived artifact, not clinical vault history.
type InsightUpdate = Partial<
  Pick<NewInsight, "status" | "dismissedReason" | "notes">
>;

export const insightQueries = {
  // Batch insert for the insight generator (§5.6) — the only writer of new
  // insight rows. No-op on an empty array (the generator's most common output).
  async createMany(rows: NewInsight[]): Promise<Insight[]> {
    if (rows.length === 0) return [];
    return db.insert(insights).values(rows).returning();
  },

  async forPatient(patientId: string): Promise<Insight[]> {
    return db
      .select()
      .from(insights)
      .where(eq(insights.patientId, patientId))
      .orderBy(desc(insights.generatedAt));
  },

  async getById(patientId: string, id: string): Promise<Insight | null> {
    const rows = await db
      .select()
      .from(insights)
      .where(and(eq(insights.id, id), eq(insights.patientId, patientId)))
      .limit(1);
    return rows[0] ?? null;
  },

  // Status and/or notes mutation. Status: any → any is permitted (the lifecycle
  // has no terminal/side-effecting transitions, unlike medication discontinue /
  // condition resolve), so there is no state-machine to guard — hence no
  // invalid_state_transition path. The route owns the dismissed_reason-clearing
  // and field-selection policy; this just writes the provided fields.
  async update(
    patientId: string,
    id: string,
    values: InsightUpdate,
  ): Promise<Insight | null> {
    const [row] = await db
      .update(insights)
      .set(values)
      .where(and(eq(insights.id, id), eq(insights.patientId, patientId)))
      .returning();
    return row ?? null;
  },
};
