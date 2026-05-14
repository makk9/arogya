import { asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  doctorChanges,
  doctors,
  type Doctor,
  type DoctorChange,
} from "@/db/schema";

export const doctorQueries = {
  async forPatient(patientId: string): Promise<Doctor[]> {
    return db
      .select()
      .from(doctors)
      .where(eq(doctors.patientId, patientId))
      .orderBy(asc(doctors.name));
  },
};

export const doctorChangeQueries = {
  async forPatient(patientId: string): Promise<DoctorChange[]> {
    return db
      .select()
      .from(doctorChanges)
      .where(
        inArray(
          doctorChanges.doctorId,
          db
            .select({ id: doctors.id })
            .from(doctors)
            .where(eq(doctors.patientId, patientId)),
        ),
      )
      .orderBy(desc(doctorChanges.changedAt));
  },
};
