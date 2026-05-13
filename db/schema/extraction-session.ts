import { relations } from "drizzle-orm";
import { jsonb, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { patients } from "./patient";
import { reports } from "./report";

export const extractionSessionStatus = pgEnum("extraction_session_status", [
  "pending",
  "ready_for_confirmation",
  "failed",
  "committed",
]);

export const extractionSessions = pgTable("extraction_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  reportId: uuid("report_id")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  status: extractionSessionStatus("status").notNull().default("pending"),
  extractionOutputJson: jsonb("extraction_output_json"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const extractionSessionsRelations = relations(
  extractionSessions,
  ({ one }) => ({
    patient: one(patients, {
      fields: [extractionSessions.patientId],
      references: [patients.id],
    }),
    report: one(reports, {
      fields: [extractionSessions.reportId],
      references: [reports.id],
    }),
  }),
);

export type ExtractionSession = typeof extractionSessions.$inferSelect;
export type NewExtractionSession = typeof extractionSessions.$inferInsert;
