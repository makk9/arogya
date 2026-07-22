import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  insightRuns,
  type InsightEntityRef,
  type InsightRun,
} from "@/db/schema";

// Run bookkeeping for the insight generator (§5.6 / §9.3). The latest row per
// patient is the debounce/concurrency signal; the history is the audit trail
// for a fire-and-forget agent that otherwise leaves no trace on empty runs.
export const insightRunQueries = {
  async getLatest(patientId: string): Promise<InsightRun | null> {
    const rows = await db
      .select()
      .from(insightRuns)
      .where(eq(insightRuns.patientId, patientId))
      .orderBy(desc(insightRuns.startedAt))
      .limit(1);
    return rows[0] ?? null;
  },

  async create(values: {
    patientId: string;
    trigger: InsightEntityRef;
    modelVersion: string;
  }): Promise<InsightRun> {
    const [row] = await db.insert(insightRuns).values(values).returning();
    return row;
  },

  async finish(
    id: string,
    values: {
      status: "succeeded" | "failed";
      generatedCount: number;
      errorCode?: string;
    },
  ): Promise<void> {
    await db
      .update(insightRuns)
      .set({
        status: values.status,
        generatedCount: values.generatedCount,
        errorCode: values.errorCode ?? null,
      })
      .where(eq(insightRuns.id, id));
  },
};
