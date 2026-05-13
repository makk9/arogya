import { relations } from "drizzle-orm";
import { date, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { doctors } from "./doctor";
import { patients } from "./patient";

export const allergyCategory = pgEnum("allergy_category", [
  "drug",
  "food",
  "environmental",
  "other",
]);

export const allergySeverity = pgEnum("allergy_severity", [
  "mild",
  "moderate",
  "severe",
  "unknown",
]);

export const allergyStatus = pgEnum("allergy_status", [
  "active",
  "resolved",
  "suspected",
  "disproved",
]);

export const allergies = pgTable("allergies", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  substance: text("substance").notNull(),
  category: allergyCategory("category").notNull(),
  reaction: text("reaction"),
  severity: allergySeverity("severity").default("unknown"),
  firstNoted: date("first_noted"),
  confirmedBy: uuid("confirmed_by").references(() => doctors.id, {
    onDelete: "set null",
  }),
  status: allergyStatus("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const allergyChanges = pgTable(
  "allergy_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    allergyId: uuid("allergy_id")
      .notNull()
      .references(() => allergies.id, { onDelete: "cascade" }),
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
    allergyIdx: index("allergy_changes_allergy_idx").on(table.allergyId),
  }),
);

export const allergiesRelations = relations(allergies, ({ one, many }) => ({
  patient: one(patients, {
    fields: [allergies.patientId],
    references: [patients.id],
  }),
  confirmingDoctor: one(doctors, {
    fields: [allergies.confirmedBy],
    references: [doctors.id],
  }),
  changes: many(allergyChanges),
}));

export const allergyChangesRelations = relations(allergyChanges, ({ one }) => ({
  allergy: one(allergies, {
    fields: [allergyChanges.allergyId],
    references: [allergies.id],
  }),
}));

export type Allergy = typeof allergies.$inferSelect;
export type NewAllergy = typeof allergies.$inferInsert;
export type AllergyChange = typeof allergyChanges.$inferSelect;
export type NewAllergyChange = typeof allergyChanges.$inferInsert;
