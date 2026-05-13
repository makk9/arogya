import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { doctors, type Doctor } from "@/db/schema";

export const doctorQueries = {
  async forPatient(patientId: string): Promise<Doctor[]> {
    return db
      .select()
      .from(doctors)
      .where(eq(doctors.patientId, patientId))
      .orderBy(asc(doctors.name));
  },
};
