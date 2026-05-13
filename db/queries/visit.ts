import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { visits, type Visit } from "@/db/schema";

export const visitQueries = {
  async forPatient(patientId: string): Promise<Visit[]> {
    return db
      .select()
      .from(visits)
      .where(eq(visits.patientId, patientId))
      .orderBy(desc(visits.visitDate));
  },
};
