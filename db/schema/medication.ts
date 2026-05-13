import { relations } from "drizzle-orm";
import { date, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { conditions } from "./condition";
import { doctors } from "./doctor";
import { patients } from "./patient";
import { reports } from "./report";
import { visits } from "./visit";

export const medicationForm = pgEnum("medication_form", [
  "tablet",
  "capsule",
  "liquid",
  "injection",
  "topical",
  "inhaler",
  "patch",
  "drops",
  "other",
]);

export const medicationCategory = pgEnum("medication_category", [
  "allopathic",
  "ayurvedic",
  "homeopathic",
  "supplement",
  "OTC",
  "other",
]);

export const medicationStatus = pgEnum("medication_status", [
  "active",
  "paused",
  "discontinued",
]);

export const medicationChangeField = pgEnum("medication_change_field", [
  "dose",
  "frequency",
  "status",
  "prescribing_doctor",
]);

export const medications = pgTable(
  "medications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    brandName: text("brand_name"),
    form: medicationForm("form"),
    currentDose: text("current_dose").notNull(),
    currentFrequency: text("current_frequency").notNull(),
    purpose: uuid("purpose").references(() => conditions.id, {
      onDelete: "set null",
    }),
    prescribingDoctor: uuid("prescribing_doctor").references(() => doctors.id, {
      onDelete: "set null",
    }),
    category: medicationCategory("category").notNull(),
    startedOn: date("started_on"),
    status: medicationStatus("status").notNull().default("active"),
    discontinuedOn: date("discontinued_on"),
    discontinuationReason: text("discontinuation_reason"),
    notes: text("notes"),
    sourceReportId: uuid("source_report_id").references(() => reports.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    patientStatusIdx: index("medications_patient_status_idx").on(
      table.patientId,
      table.status,
    ),
  }),
);

export const medicationChanges = pgTable(
  "medication_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    medicationId: uuid("medication_id")
      .notNull()
      .references(() => medications.id, { onDelete: "cascade" }),
    changedAt: timestamp("changed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    field: medicationChangeField("field").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    reason: text("reason"),
    recordedBy: uuid("recorded_by"),
    linkedVisitId: uuid("linked_visit_id").references(() => visits.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    medicationIdx: index("medication_changes_medication_idx").on(
      table.medicationId,
    ),
  }),
);

export const medicationsRelations = relations(medications, ({ one, many }) => ({
  patient: one(patients, {
    fields: [medications.patientId],
    references: [patients.id],
  }),
  purposeCondition: one(conditions, {
    fields: [medications.purpose],
    references: [conditions.id],
  }),
  prescriber: one(doctors, {
    fields: [medications.prescribingDoctor],
    references: [doctors.id],
  }),
  sourceReport: one(reports, {
    fields: [medications.sourceReportId],
    references: [reports.id],
  }),
  changes: many(medicationChanges),
}));

export const medicationChangesRelations = relations(
  medicationChanges,
  ({ one }) => ({
    medication: one(medications, {
      fields: [medicationChanges.medicationId],
      references: [medications.id],
    }),
    linkedVisit: one(visits, {
      fields: [medicationChanges.linkedVisitId],
      references: [visits.id],
    }),
  }),
);

export type Medication = typeof medications.$inferSelect;
export type NewMedication = typeof medications.$inferInsert;
export type MedicationChange = typeof medicationChanges.$inferSelect;
export type NewMedicationChange = typeof medicationChanges.$inferInsert;
