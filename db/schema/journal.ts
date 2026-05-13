import { relations } from "drizzle-orm";
import { date, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { patients } from "./patient";
import { reports } from "./report";

export const journalMood = pgEnum("journal_mood", [
  "concerned",
  "neutral",
  "hopeful",
  "frustrated",
  "other",
]);

export type JournalLinkedEntity = { type: string; id: string };

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    entryDate: date("entry_date").notNull(),
    title: text("title"),
    content: text("content").notNull(),
    linkedEntities: jsonb("linked_entities").$type<JournalLinkedEntity[]>(),
    mood: journalMood("mood"),
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
    patientIdx: index("journal_entries_patient_idx").on(table.patientId),
  }),
);

export const journalEntriesRelations = relations(journalEntries, ({ one }) => ({
  patient: one(patients, {
    fields: [journalEntries.patientId],
    references: [patients.id],
  }),
  sourceReport: one(reports, {
    fields: [journalEntries.sourceReportId],
    references: [reports.id],
  }),
}));

export type JournalEntry = typeof journalEntries.$inferSelect;
export type NewJournalEntry = typeof journalEntries.$inferInsert;
