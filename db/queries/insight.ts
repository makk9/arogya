import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { insights, type Insight } from "@/db/schema";

export const insightQueries = {
  async forPatient(patientId: string): Promise<Insight[]> {
    return db
      .select()
      .from(insights)
      .where(eq(insights.patientId, patientId))
      .orderBy(desc(insights.generatedAt));
  },
};
