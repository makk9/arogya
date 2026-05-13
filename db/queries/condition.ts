import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { conditions, type Condition } from "@/db/schema";

export const conditionQueries = {
  async forPatient(patientId: string): Promise<Condition[]> {
    return db
      .select()
      .from(conditions)
      .where(eq(conditions.patientId, patientId))
      .orderBy(desc(conditions.createdAt));
  },

  async active(patientId: string): Promise<Condition[]> {
    return db
      .select()
      .from(conditions)
      .where(
        and(eq(conditions.patientId, patientId), eq(conditions.status, "active")),
      )
      .orderBy(desc(conditions.createdAt));
  },
};
