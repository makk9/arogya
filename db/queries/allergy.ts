import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  allergies,
  allergyChanges,
  type Allergy,
  type AllergyChange,
} from "@/db/schema";

export const allergyQueries = {
  async forPatient(patientId: string): Promise<Allergy[]> {
    return db
      .select()
      .from(allergies)
      .where(eq(allergies.patientId, patientId))
      .orderBy(desc(allergies.createdAt));
  },
};

export const allergyChangeQueries = {
  async forPatient(patientId: string): Promise<AllergyChange[]> {
    return db
      .select()
      .from(allergyChanges)
      .where(
        inArray(
          allergyChanges.allergyId,
          db
            .select({ id: allergies.id })
            .from(allergies)
            .where(eq(allergies.patientId, patientId)),
        ),
      )
      .orderBy(desc(allergyChanges.changedAt));
  },
};
