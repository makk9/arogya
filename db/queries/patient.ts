import { eq } from "drizzle-orm";

import { db } from "@/db";
import { patients, type Patient } from "@/db/schema";

export const patientQueries = {
  async getById(patientId: string): Promise<Patient | undefined> {
    const rows = await db
      .select()
      .from(patients)
      .where(eq(patients.id, patientId))
      .limit(1);
    return rows[0];
  },
};
