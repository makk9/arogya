import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { journalEntries, type JournalEntry } from "@/db/schema";

export const journalQueries = {
  async forPatient(patientId: string): Promise<JournalEntry[]> {
    return db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.patientId, patientId))
      .orderBy(desc(journalEntries.entryDate));
  },
};
