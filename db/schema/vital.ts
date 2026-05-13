import { relations } from "drizzle-orm";
import { index, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { patients } from "./patient";
import { reports } from "./report";
import { symptomEpisodes } from "./symptom";

export const vitalReadingType = pgEnum("vital_reading_type", [
  "blood_pressure",
  "weight",
  "blood_glucose",
  "temperature",
  "heart_rate",
  "oxygen_saturation",
  "respiratory_rate",
  "other",
]);

export const vitalContext = pgEnum("vital_context", [
  "fasting",
  "post_meal",
  "morning",
  "evening",
  "pre_medication",
  "post_medication",
  "other",
]);

export const vitalFlag = pgEnum("vital_flag", [
  "normal",
  "low",
  "high",
  "critical",
]);

export const vitalReadings = pgTable(
  "vital_readings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    readingType: vitalReadingType("reading_type").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" })
      .notNull(),
    valuePrimary: numeric("value_primary"),
    valueSecondary: numeric("value_secondary"),
    unit: text("unit").notNull(),
    context: vitalContext("context"),
    flag: vitalFlag("flag"),
    linkedSymptomId: uuid("linked_symptom_id").references(
      () => symptomEpisodes.id,
      { onDelete: "set null" },
    ),
    notes: text("notes"),
    recordedBy: uuid("recorded_by"),
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
    patientRecordedIdx: index("vital_readings_patient_recorded_idx").on(
      table.patientId,
      table.recordedAt.desc(),
    ),
    typeRecordedIdx: index("vital_readings_type_recorded_idx").on(
      table.readingType,
      table.recordedAt.desc(),
    ),
  }),
);

export const vitalReadingsRelations = relations(vitalReadings, ({ one }) => ({
  patient: one(patients, {
    fields: [vitalReadings.patientId],
    references: [patients.id],
  }),
  linkedSymptom: one(symptomEpisodes, {
    fields: [vitalReadings.linkedSymptomId],
    references: [symptomEpisodes.id],
  }),
  sourceReport: one(reports, {
    fields: [vitalReadings.sourceReportId],
    references: [reports.id],
  }),
}));

export type VitalReading = typeof vitalReadings.$inferSelect;
export type NewVitalReading = typeof vitalReadings.$inferInsert;
