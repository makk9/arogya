import { relations } from "drizzle-orm";
import { date, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { allergies } from "./allergy";
import { conditions } from "./condition";
import { doctors } from "./doctor";
import { extractionSessions } from "./extraction-session";
import { familyHistory as familyHistoryEntries } from "./family-history";
import { insights } from "./insight";
import { journalEntries } from "./journal";
import { labReports, labResults } from "./lab";
import { lifestyleChanges, lifestyleProfiles } from "./lifestyle";
import { medications } from "./medication";
import { reports } from "./report";
import { symptomEpisodes, symptomTypes } from "./symptom";
import { visits } from "./visit";
import { vitalReadings } from "./vital";

export const sex = pgEnum("sex", ["male", "female", "intersex", "unspecified"]);
export const bloodType = pgEnum("blood_type", [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
]);

export const patients = pgTable("patients", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: uuid("owner_user_id").notNull(),
  name: text("name").notNull(),
  preferredName: text("preferred_name"),
  dateOfBirth: date("date_of_birth").notNull(),
  sex: sex("sex").notNull(),
  bloodType: bloodType("blood_type"),
  heightCm: numeric("height_cm"),
  currentWeightKg: numeric("current_weight_kg"),
  country: text("country").notNull(),
  city: text("city"),
  timezone: text("timezone").notNull(),
  familyHistory: text("family_history"),
  photoUrl: text("photo_url"),
  // Free-form markdown editorial layer surfaced as the patient profile's NOTES
  // section (design.md 6.10:1689). Distinct from `family_history` (a dead
  // legacy text column — family history is its own first-class entity now,
  // 6.10:1660). Added in Phase D for the patient-profile vertical.
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const patientsRelations = relations(patients, ({ many }) => ({
  doctors: many(doctors),
  conditions: many(conditions),
  medications: many(medications),
  allergies: many(allergies),
  lifestyleProfile: many(lifestyleProfiles),
  lifestyleChanges: many(lifestyleChanges),
  familyHistoryEntries: many(familyHistoryEntries),
  visits: many(visits),
  labReports: many(labReports),
  labResults: many(labResults),
  vitalReadings: many(vitalReadings),
  symptomTypes: many(symptomTypes),
  symptomEpisodes: many(symptomEpisodes),
  reports: many(reports),
  journalEntries: many(journalEntries),
  insights: many(insights),
  extractionSessions: many(extractionSessions),
}));

export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;
