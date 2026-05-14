import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  lifestyleChanges,
  lifestyleProfiles,
  type LifestyleChange,
  type LifestyleProfile,
} from "@/db/schema";

export const lifestyleQueries = {
  async getForPatient(patientId: string): Promise<LifestyleProfile | undefined> {
    const rows = await db
      .select()
      .from(lifestyleProfiles)
      .where(eq(lifestyleProfiles.patientId, patientId))
      .limit(1);
    return rows[0];
  },
};

export const lifestyleChangeQueries = {
  async forPatient(patientId: string): Promise<LifestyleChange[]> {
    return db
      .select()
      .from(lifestyleChanges)
      .where(eq(lifestyleChanges.patientId, patientId))
      .orderBy(desc(lifestyleChanges.changedAt));
  },
};
