import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  conditionChanges,
  conditions,
  type Condition,
  type ConditionChange,
} from "@/db/schema";

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

export const conditionChangeQueries = {
  async forPatient(patientId: string): Promise<ConditionChange[]> {
    return db
      .select()
      .from(conditionChanges)
      .where(
        inArray(
          conditionChanges.conditionId,
          db
            .select({ id: conditions.id })
            .from(conditions)
            .where(eq(conditions.patientId, patientId)),
        ),
      )
      .orderBy(desc(conditionChanges.changedAt));
  },
};
