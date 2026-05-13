import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  symptomEpisodes,
  symptomTypes,
  type SymptomEpisode,
  type SymptomType,
} from "@/db/schema";

export const symptomTypeQueries = {
  async forPatient(patientId: string): Promise<SymptomType[]> {
    return db
      .select()
      .from(symptomTypes)
      .where(eq(symptomTypes.patientId, patientId))
      .orderBy(desc(symptomTypes.createdAt));
  },
};

export const symptomEpisodeQueries = {
  async forPatient(patientId: string): Promise<SymptomEpisode[]> {
    return db
      .select()
      .from(symptomEpisodes)
      .where(eq(symptomEpisodes.patientId, patientId))
      .orderBy(desc(symptomEpisodes.startedAt));
  },
};
