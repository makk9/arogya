import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { medications, type Medication } from "@/db/schema";

export const medicationQueries = {
  async forPatient(patientId: string): Promise<Medication[]> {
    return db
      .select()
      .from(medications)
      .where(eq(medications.patientId, patientId))
      .orderBy(desc(medications.createdAt));
  },

  async active(patientId: string): Promise<Medication[]> {
    return db
      .select()
      .from(medications)
      .where(
        and(
          eq(medications.patientId, patientId),
          eq(medications.status, "active"),
        ),
      )
      .orderBy(desc(medications.createdAt));
  },
};
