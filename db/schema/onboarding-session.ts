import { relations } from "drizzle-orm";
import {
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { patients } from "./patient";

/**
 * Onboarding interview persistence (design.md 5.8 / 6.3) — Phase E item E4.
 *
 * NOT one of the locked 14 entities (Phase 4). Like `extraction_sessions` and
 * `chat_sessions`, this is infrastructure: it makes the interview interruptible
 * and resumable per phase (§5.8:1011 locked behavior). Added with explicit
 * sign-off 2026-07-22 — see decisions.md. Singleton per patient; carries no
 * clinical fields — everything the interview captures is written to the real
 * entity tables as it's said (the live-transparency pattern), so this row is
 * only the conversation's position and transcript.
 *
 * The transcript lives here as jsonb rather than in `chat_messages` so the
 * interview never appears in the CHATS history list — it's an intake flow, not
 * a findable conversation (sign-off 2026-07-22).
 */

// The 8 interview phases in §6.3/§10.3 order, plus the terminal marker. (§5.8's
// list differs at phases 6/8 — §6.3/§10.3 supersede; deviation logged
// 2026-07-22.)
export const onboardingPhase = pgEnum("onboarding_phase", [
  "patient",
  "conditions",
  "medications",
  "doctors",
  "allergies",
  "family_history",
  "lifestyle",
  "loose_ends",
  "complete",
]);

export const onboardingSessionStatus = pgEnum("onboarding_session_status", [
  "active",
  "completed",
]);

export type OnboardingMessage = {
  role: "user" | "assistant";
  content: string;
};

export const onboardingSessions = pgTable(
  "onboarding_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    status: onboardingSessionStatus("status").notNull().default("active"),
    currentPhase: onboardingPhase("current_phase").notNull().default("patient"),
    // Full interview transcript in turn order. Bounded — an interview is a few
    // dozen turns — so a jsonb column beats a second table here.
    messages: jsonb("messages")
      .$type<OnboardingMessage[]>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // One interview per patient — resuming always lands on the same row.
    uniqueIndex("onboarding_sessions_patient_unique_idx").on(table.patientId),
  ],
);

export const onboardingSessionsRelations = relations(
  onboardingSessions,
  ({ one }) => ({
    patient: one(patients, {
      fields: [onboardingSessions.patientId],
      references: [patients.id],
    }),
  }),
);

export type OnboardingSession = typeof onboardingSessions.$inferSelect;
export type NewOnboardingSession = typeof onboardingSessions.$inferInsert;
export type OnboardingPhase = (typeof onboardingPhase.enumValues)[number];
