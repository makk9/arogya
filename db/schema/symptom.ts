import { relations } from "drizzle-orm";
import { date, index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { conditions } from "./condition";
import { patients } from "./patient";
import { reports } from "./report";
import { visits } from "./visit";

export const symptomBodyArea = pgEnum("symptom_body_area", [
  "head",
  "chest",
  "abdomen",
  "back",
  "arms",
  "legs",
  "skin",
  "general",
  "other",
]);

export const symptomStatus = pgEnum("symptom_status", [
  "active",
  "resolved",
  "monitoring",
]);

export const symptomEpisodeSeverity = pgEnum("symptom_episode_severity", [
  "mild",
  "moderate",
  "severe",
]);

export const symptomTypes = pgTable("symptom_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  bodyArea: symptomBodyArea("body_area"),
  linkedCondition: uuid("linked_condition").references(() => conditions.id, {
    onDelete: "set null",
  }),
  firstNoted: date("first_noted"),
  status: symptomStatus("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const symptomEpisodes = pgTable(
  "symptom_episodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    symptomTypeId: uuid("symptom_type_id")
      .notNull()
      .references(() => symptomTypes.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" })
      .notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
    durationMinutes: integer("duration_minutes"),
    severity: symptomEpisodeSeverity("severity"),
    description: text("description"),
    triggers: text("triggers"),
    relief: text("relief"),
    linkedVitalIds: uuid("linked_vital_ids").array(),
    linkedVisitId: uuid("linked_visit_id").references(() => visits.id, {
      onDelete: "set null",
    }),
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
    patientStartedIdx: index("symptom_episodes_patient_started_idx").on(
      table.patientId,
      table.startedAt.desc(),
    ),
    typeStartedIdx: index("symptom_episodes_type_started_idx").on(
      table.symptomTypeId,
      table.startedAt.desc(),
    ),
  }),
);

export const symptomTypesRelations = relations(symptomTypes, ({ one, many }) => ({
  patient: one(patients, {
    fields: [symptomTypes.patientId],
    references: [patients.id],
  }),
  linkedConditionRef: one(conditions, {
    fields: [symptomTypes.linkedCondition],
    references: [conditions.id],
  }),
  episodes: many(symptomEpisodes),
}));

export const symptomEpisodesRelations = relations(symptomEpisodes, ({ one }) => ({
  symptomType: one(symptomTypes, {
    fields: [symptomEpisodes.symptomTypeId],
    references: [symptomTypes.id],
  }),
  patient: one(patients, {
    fields: [symptomEpisodes.patientId],
    references: [patients.id],
  }),
  linkedVisit: one(visits, {
    fields: [symptomEpisodes.linkedVisitId],
    references: [visits.id],
  }),
  sourceReport: one(reports, {
    fields: [symptomEpisodes.sourceReportId],
    references: [reports.id],
  }),
}));

export type SymptomType = typeof symptomTypes.$inferSelect;
export type NewSymptomType = typeof symptomTypes.$inferInsert;
export type SymptomEpisode = typeof symptomEpisodes.$inferSelect;
export type NewSymptomEpisode = typeof symptomEpisodes.$inferInsert;
