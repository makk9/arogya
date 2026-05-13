import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { reports, type Report } from "@/db/schema";

export const reportQueries = {
  async forPatient(patientId: string): Promise<Report[]> {
    return db
      .select()
      .from(reports)
      .where(eq(reports.patientId, patientId))
      .orderBy(desc(reports.reportDate));
  },
};
