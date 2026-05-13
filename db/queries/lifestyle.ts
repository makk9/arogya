import { eq } from "drizzle-orm";

import { db } from "@/db";
import { lifestyleProfiles, type LifestyleProfile } from "@/db/schema";

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
