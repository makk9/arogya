import { asc, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  labReports,
  labResults,
  type LabReport,
  type LabResult,
} from "@/db/schema";

export const labReportQueries = {
  async forPatient(patientId: string): Promise<LabReport[]> {
    return db
      .select()
      .from(labReports)
      .where(eq(labReports.patientId, patientId))
      .orderBy(desc(labReports.reportDate));
  },
};

export const labResultQueries = {
  async forReport(labReportId: string): Promise<LabResult[]> {
    return db
      .select()
      .from(labResults)
      .where(eq(labResults.labReportId, labReportId))
      .orderBy(asc(labResults.marker));
  },

  async forPatient(patientId: string): Promise<LabResult[]> {
    return db
      .select()
      .from(labResults)
      .where(eq(labResults.patientId, patientId))
      .orderBy(desc(labResults.resultDate), asc(labResults.marker));
  },
};
