import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { allergies, type Allergy } from "@/db/schema";

export const allergyQueries = {
  async forPatient(patientId: string): Promise<Allergy[]> {
    return db
      .select()
      .from(allergies)
      .where(eq(allergies.patientId, patientId))
      .orderBy(desc(allergies.createdAt));
  },
};
