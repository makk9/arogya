import { relations } from "drizzle-orm";
import { date, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { doctors } from "./doctor";
import { patients } from "./patient";
import { reports } from "./report";

export const conditionCategory = pgEnum("condition_category", [
  "cardiovascular",
  "endocrine",
  "renal",
  "neurological",
  "musculoskeletal",
  "mental_health",
  "oncology",
  "hematological",
  "dermatological",
  "gastrointestinal",
  "respiratory",
  "autoimmune",
  "other",
]);

export const conditionStatus = pgEnum("condition_status", [
  "active",
  "controlled",
  "in_remission",
  "resolved",
  "suspected",
]);

export const conditionSeverity = pgEnum("condition_severity", [
  "mild",
  "moderate",
  "severe",
  "unknown",
]);

export const conditionChangeField = pgEnum("condition_change_field", [
  "status",
  "severity",
  "managing_doctor",
  "notes",
]);

export const conditions = pgTable(
  "conditions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: conditionCategory("category"),
    icdCode: text("icd_code"),
    status: conditionStatus("status").notNull().default("active"),
    severity: conditionSeverity("severity"),
    diagnosedOn: date("diagnosed_on"),
    diagnosedBy: uuid("diagnosed_by").references(() => doctors.id, {
      onDelete: "set null",
    }),
    managingDoctor: uuid("managing_doctor").references(() => doctors.id, {
      onDelete: "set null",
    }),
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
    patientStatusIdx: index("conditions_patient_status_idx").on(
      table.patientId,
      table.status,
    ),
  }),
);

export const conditionChanges = pgTable(
  "condition_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conditionId: uuid("condition_id")
      .notNull()
      .references(() => conditions.id, { onDelete: "cascade" }),
    changedAt: timestamp("changed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    field: conditionChangeField("field").notNull(),
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
    conditionIdx: index("condition_changes_condition_idx").on(table.conditionId),
  }),
);

export const conditionsRelations = relations(conditions, ({ one, many }) => ({
  patient: one(patients, {
    fields: [conditions.patientId],
    references: [patients.id],
  }),
  diagnosedByDoctor: one(doctors, {
    fields: [conditions.diagnosedBy],
    references: [doctors.id],
    relationName: "condition_diagnosed_by",
  }),
  managingDoctorRef: one(doctors, {
    fields: [conditions.managingDoctor],
    references: [doctors.id],
    relationName: "condition_managing_doctor",
  }),
  sourceReport: one(reports, {
    fields: [conditions.sourceReportId],
    references: [reports.id],
  }),
  changes: many(conditionChanges),
}));

export const conditionChangesRelations = relations(
  conditionChanges,
  ({ one }) => ({
    condition: one(conditions, {
      fields: [conditionChanges.conditionId],
      references: [conditions.id],
    }),
  }),
);

export type Condition = typeof conditions.$inferSelect;
export type NewCondition = typeof conditions.$inferInsert;
export type ConditionChange = typeof conditionChanges.$inferSelect;
export type NewConditionChange = typeof conditionChanges.$inferInsert;
