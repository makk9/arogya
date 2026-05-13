import { relations } from "drizzle-orm";
import { date, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { doctors } from "./doctor";
import { patients } from "./patient";
import { visits } from "./visit";

export const reportType = pgEnum("report_type", [
  "discharge_summary",
  "doctor_letter",
  "prescription",
  "insurance",
  "imaging",
  "other",
]);

export const reportStatus = pgEnum("report_status", [
  "extracting",
  "ready",
  "failed",
  "committed",
]);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    reportType: reportType("report_type"),
    reportDate: date("report_date").notNull(),
    sourceFileUrl: text("source_file_url"),
    content: text("content"),
    linkedVisitId: uuid("linked_visit_id").references(() => visits.id, {
      onDelete: "set null",
    }),
    linkedDoctorId: uuid("linked_doctor_id").references(() => doctors.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    recordedBy: uuid("recorded_by"),
    status: reportStatus("status").notNull().default("ready"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    patientIdx: index("reports_patient_idx").on(table.patientId),
  }),
);

export const reportsRelations = relations(reports, ({ one }) => ({
  patient: one(patients, {
    fields: [reports.patientId],
    references: [patients.id],
  }),
  linkedVisit: one(visits, {
    fields: [reports.linkedVisitId],
    references: [visits.id],
  }),
  linkedDoctor: one(doctors, {
    fields: [reports.linkedDoctorId],
    references: [doctors.id],
  }),
}));

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
