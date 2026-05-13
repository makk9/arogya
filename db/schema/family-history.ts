import { relations } from "drizzle-orm";
import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { patients } from "./patient";

export const familyHistoryRelation = pgEnum("family_history_relation", [
  "parent",
  "sibling",
  "child",
  "grandparent",
  "aunt_uncle",
  "cousin",
  "other",
]);

export const familyHistory = pgTable("family_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  relation: familyHistoryRelation("relation").notNull(),
  relationSpecific: text("relation_specific"),
  conditionName: text("condition_name").notNull(),
  ageOfOnset: integer("age_of_onset"),
  outcome: text("outcome"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const familyHistoryRelations = relations(familyHistory, ({ one }) => ({
  patient: one(patients, {
    fields: [familyHistory.patientId],
    references: [patients.id],
  }),
}));

export type FamilyHistoryEntry = typeof familyHistory.$inferSelect;
export type NewFamilyHistoryEntry = typeof familyHistory.$inferInsert;
