import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { patients } from "./patient";

export const lifestyleExerciseIntensity = pgEnum(
  "lifestyle_exercise_intensity",
  ["sedentary", "light", "moderate", "active", "very_active"],
);

export const lifestyleStressLevel = pgEnum("lifestyle_stress_level", [
  "low",
  "moderate",
  "high",
  "variable",
]);

export const lifestyleTobaccoUse = pgEnum("lifestyle_tobacco_use", [
  "never",
  "former",
  "current",
]);

export const lifestyleAlcoholUse = pgEnum("lifestyle_alcohol_use", [
  "never",
  "occasional",
  "regular",
  "former",
]);

export const lifestyleProfiles = pgTable(
  "lifestyle_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    dietPattern: text("diet_pattern"),
    dietRestrictions: text("diet_restrictions").array(),
    exercisePattern: text("exercise_pattern"),
    exerciseIntensity: lifestyleExerciseIntensity("exercise_intensity"),
    sleepPattern: text("sleep_pattern"),
    stressLevel: lifestyleStressLevel("stress_level"),
    stressContext: text("stress_context"),
    tobaccoUse: lifestyleTobaccoUse("tobacco_use"),
    alcoholUse: lifestyleAlcoholUse("alcohol_use"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    patientUniqueIdx: uniqueIndex("lifestyle_profiles_patient_unique_idx").on(
      table.patientId,
    ),
  }),
);

export const lifestyleChanges = pgTable(
  "lifestyle_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    changedAt: timestamp("changed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    field: text("field").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    reason: text("reason"),
    recordedBy: uuid("recorded_by"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    patientIdx: index("lifestyle_changes_patient_idx").on(table.patientId),
  }),
);

export const lifestyleProfilesRelations = relations(
  lifestyleProfiles,
  ({ one }) => ({
    patient: one(patients, {
      fields: [lifestyleProfiles.patientId],
      references: [patients.id],
    }),
  }),
);

export const lifestyleChangesRelations = relations(
  lifestyleChanges,
  ({ one }) => ({
    patient: one(patients, {
      fields: [lifestyleChanges.patientId],
      references: [patients.id],
    }),
  }),
);

export type LifestyleProfile = typeof lifestyleProfiles.$inferSelect;
export type NewLifestyleProfile = typeof lifestyleProfiles.$inferInsert;
export type LifestyleChange = typeof lifestyleChanges.$inferSelect;
export type NewLifestyleChange = typeof lifestyleChanges.$inferInsert;
