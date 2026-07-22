import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type { InsightEntityRef } from "./insight";
import { patients } from "./patient";

export const insightRunStatus = pgEnum("insight_run_status", [
  "running",
  "succeeded",
  "failed",
]);

/*
 * One row per insight-generator invocation (§5.6 / §9.3). Exists because the
 * 30s debounce needs to see runs that produced zero insights — the most common
 * outcome by design — which leave no trace in `insights`. Doubles as a
 * concurrency guard (a fresh `running` row blocks a second run) and an audit
 * trail for the fire-and-forget agent. Post-Phase-A schema addition signed off
 * 2026-07-20 (decisions.md).
 */
export const insightRuns = pgTable(
  "insight_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    // The entity creation/change that fired this run — becomes `triggered_by`
    // on any insights it writes.
    trigger: jsonb("trigger").$type<InsightEntityRef>().notNull(),
    status: insightRunStatus("status").notNull().default("running"),
    generatedCount: integer("generated_count").notNull().default(0),
    // AgentError code or errorCode(err) — never message content (PHI).
    errorCode: text("error_code"),
    modelVersion: text("model_version").notNull(),
  },
  (table) => ({
    patientStartedIdx: index("insight_runs_patient_started_idx").on(
      table.patientId,
      table.startedAt.desc(),
    ),
  }),
);

export const insightRunsRelations = relations(insightRuns, ({ one }) => ({
  patient: one(patients, {
    fields: [insightRuns.patientId],
    references: [patients.id],
  }),
}));

export type InsightRun = typeof insightRuns.$inferSelect;
export type NewInsightRun = typeof insightRuns.$inferInsert;
