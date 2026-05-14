import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  medicationChanges,
  medications,
  type Medication,
  type MedicationChange,
} from "@/db/schema";

export const medicationQueries = {
  async forPatient(patientId: string): Promise<Medication[]> {
    return db
      .select()
      .from(medications)
      .where(eq(medications.patientId, patientId))
      .orderBy(desc(medications.createdAt));
  },

  async active(patientId: string): Promise<Medication[]> {
    return db
      .select()
      .from(medications)
      .where(
        and(
          eq(medications.patientId, patientId),
          eq(medications.status, "active"),
        ),
      )
      .orderBy(desc(medications.createdAt));
  },
};

export const medicationChangeQueries = {
  async forPatient(patientId: string): Promise<MedicationChange[]> {
    return db
      .select()
      .from(medicationChanges)
      .where(
        inArray(
          medicationChanges.medicationId,
          db
            .select({ id: medications.id })
            .from(medications)
            .where(eq(medications.patientId, patientId)),
        ),
      )
      .orderBy(desc(medicationChanges.changedAt));
  },
};
