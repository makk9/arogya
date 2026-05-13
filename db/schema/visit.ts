import { relations } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { date, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { doctors } from "./doctor";
import { patients } from "./patient";
import { reports } from "./report";

export const visitType = pgEnum("visit_type", [
  "routine_followup",
  "new_consultation",
  "urgent",
  "specialist_referral",
  "second_opinion",
  "telemedicine",
  "hospitalization",
  "surgery",
  "other",
]);

export const visitStatus = pgEnum("visit_status", [
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
]);

export const visits = pgTable(
  "visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "restrict" }),
    visitDate: date("visit_date").notNull(),
    visitType: visitType("visit_type"),
    chiefComplaint: text("chief_complaint"),
    summary: text("summary"),
    diagnosisText: text("diagnosis_text"),
    nextSteps: text("next_steps"),
    status: visitStatus("status").notNull().default("completed"),
    notes: text("notes"),
    sourceReportId: uuid("source_report_id").references(
      (): AnyPgColumn => reports.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    patientDateIdx: index("visits_patient_date_idx").on(
      table.patientId,
      table.visitDate.desc(),
    ),
  }),
);

export const visitsRelations = relations(visits, ({ one }) => ({
  patient: one(patients, {
    fields: [visits.patientId],
    references: [patients.id],
  }),
  doctor: one(doctors, {
    fields: [visits.doctorId],
    references: [doctors.id],
  }),
  sourceReport: one(reports, {
    fields: [visits.sourceReportId],
    references: [reports.id],
  }),
}));

export type Visit = typeof visits.$inferSelect;
export type NewVisit = typeof visits.$inferInsert;
