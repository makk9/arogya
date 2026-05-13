import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { familyHistory, type FamilyHistoryEntry } from "@/db/schema";

export const familyHistoryQueries = {
  async forPatient(patientId: string): Promise<FamilyHistoryEntry[]> {
    return db
      .select()
      .from(familyHistory)
      .where(eq(familyHistory.patientId, patientId))
      .orderBy(desc(familyHistory.createdAt));
  },
};
