import { relations } from "drizzle-orm";
import { date, index, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { conditions } from "./condition";
import { doctors } from "./doctor";
import { patients } from "./patient";
import { reports } from "./report";
import { visits } from "./visit";

export const labResultFlag = pgEnum("lab_result_flag", [
  "normal",
  "low",
  "high",
  "critical",
]);

export const labReports = pgTable(
  "lab_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    reportDate: date("report_date").notNull(),
    reportType: text("report_type"),
    labName: text("lab_name"),
    orderedBy: uuid("ordered_by").references(() => doctors.id, {
      onDelete: "set null",
    }),
    linkedVisitId: uuid("linked_visit_id").references(() => visits.id, {
      onDelete: "set null",
    }),
    sourceFileUrl: text("source_file_url"),
    summary: text("summary"),
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
    patientDateIdx: index("lab_reports_patient_date_idx").on(
      table.patientId,
      table.reportDate.desc(),
    ),
  }),
);

export const labResults = pgTable(
  "lab_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    labReportId: uuid("lab_report_id")
      .notNull()
      .references(() => labReports.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    marker: text("marker").notNull(),
    markerNormalized: text("marker_normalized"),
    value: numeric("value"),
    valueText: text("value_text"),
    unit: text("unit"),
    referenceLow: numeric("reference_low"),
    referenceHigh: numeric("reference_high"),
    flag: labResultFlag("flag"),
    resultDate: date("result_date").notNull(),
    linkedCondition: uuid("linked_condition").references(() => conditions.id, {
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
    patientMarkerDateIdx: index("lab_results_patient_marker_date_idx").on(
      table.patientId,
      table.markerNormalized,
      table.resultDate.desc(),
    ),
    reportIdx: index("lab_results_report_idx").on(table.labReportId),
  }),
);

export const labReportsRelations = relations(labReports, ({ one, many }) => ({
  patient: one(patients, {
    fields: [labReports.patientId],
    references: [patients.id],
  }),
  orderingDoctor: one(doctors, {
    fields: [labReports.orderedBy],
    references: [doctors.id],
  }),
  linkedVisit: one(visits, {
    fields: [labReports.linkedVisitId],
    references: [visits.id],
  }),
  sourceReport: one(reports, {
    fields: [labReports.sourceReportId],
    references: [reports.id],
  }),
  results: many(labResults),
}));

export const labResultsRelations = relations(labResults, ({ one }) => ({
  labReport: one(labReports, {
    fields: [labResults.labReportId],
    references: [labReports.id],
  }),
  patient: one(patients, {
    fields: [labResults.patientId],
    references: [patients.id],
  }),
  linkedConditionRef: one(conditions, {
    fields: [labResults.linkedCondition],
    references: [conditions.id],
  }),
}));

export type LabReport = typeof labReports.$inferSelect;
export type NewLabReport = typeof labReports.$inferInsert;
export type LabResult = typeof labResults.$inferSelect;
export type NewLabResult = typeof labResults.$inferInsert;
