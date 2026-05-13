import { relations } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { patients } from "./patient";

export const insightCategory = pgEnum("insight_category", [
  "pattern",
  "risk",
  "gap",
  "interaction",
  "trend",
  "improvement",
]);

export const insightSeverity = pgEnum("insight_severity", [
  "informational",
  "watch",
  "attention",
  "urgent",
]);

export const insightStatus = pgEnum("insight_status", [
  "new",
  "seen",
  "acknowledged",
  "dismissed",
  "acted_on",
]);

export type InsightEntityRef = { type: string; id: string };
export type InsightCitedSource = { type: string; id: string; snippet: string };
export type InsightExternalRef = { title: string; url: string; snippet: string };

export const insights = pgTable(
  "insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    generatedAt: timestamp("generated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    category: insightCategory("category").notNull(),
    severity: insightSeverity("severity").notNull(),
    triggeredBy: jsonb("triggered_by").$type<InsightEntityRef>().notNull(),
    citedSources: jsonb("cited_sources")
      .$type<InsightCitedSource[]>()
      .notNull(),
    externalRefs: jsonb("external_refs").$type<InsightExternalRef[]>(),
    linkedEntities: jsonb("linked_entities").$type<InsightEntityRef[]>(),
    status: insightStatus("status").notNull().default("new"),
    dismissedReason: text("dismissed_reason"),
    modelVersion: text("model_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    patientStatusGeneratedIdx: index(
      "insights_patient_status_generated_idx",
    ).on(table.patientId, table.status, table.generatedAt.desc()),
  }),
);

export const insightsRelations = relations(insights, ({ one }) => ({
  patient: one(patients, {
    fields: [insights.patientId],
    references: [patients.id],
  }),
}));

export type Insight = typeof insights.$inferSelect;
export type NewInsight = typeof insights.$inferInsert;
