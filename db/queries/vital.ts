import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { vitalReadings, type VitalReading } from "@/db/schema";

export const vitalQueries = {
  async forPatient(patientId: string): Promise<VitalReading[]> {
    return db
      .select()
      .from(vitalReadings)
      .where(eq(vitalReadings.patientId, patientId))
      .orderBy(desc(vitalReadings.recordedAt));
  },
};
