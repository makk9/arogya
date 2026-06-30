import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { patients } from "./patient";

/**
 * Chat session persistence (design.md 6.2 full-screen chat) — Phase E item E0b.
 *
 * NOT one of the locked 14 entities (Phase 4). Like `extraction_sessions`, this
 * is infrastructure: it gives the synthesis-chat surface reopenable, titled,
 * findable conversations (the substrate auto-titling E6 and doctor-brief
 * persistence E7 depend on). Added with explicit sign-off 2026-06-28 — see
 * decisions.md. It carries no clinical fields, no change log, no
 * `source_report_id`.
 *
 * Grounding ("grounded in: [entities] · N sources", 6.2:1192/1207) is NOT
 * stored here — it's re-derived at render time by tokenizing each assistant
 * message's citation pills, per the backlinks-derived-not-stored tripwire.
 */

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    // Null until the first AI reply lands and auto-titling (6.2:1217, E6) fills
    // it in. The surface renders a fallback (first user message) while null.
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    // Bumped on every new message (queries.addMessage) so the CHATS history list
    // can sort most-recently-active first.
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // History list: a patient's sessions, most-recent-activity first.
    index("chat_sessions_patient_updated_idx").on(
      table.patientId,
      table.updatedAt.desc(),
    ),
  ],
);

export const chatMessageRole = pgEnum("chat_message_role", [
  "user",
  "assistant",
]);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    role: chatMessageRole("role").notNull(),
    // Markdown body with inline `§`/`↗` citation pills (synthesis is text-only
    // in v1). Reconstructed as a single text part when seeding `useChat` on
    // load. If structured parts arrive later (E1 inline log-confirmations), add
    // a nullable jsonb `parts` column then — additive migration.
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Load a conversation's messages in send order.
    index("chat_messages_session_created_idx").on(
      table.sessionId,
      table.createdAt,
    ),
  ],
);

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  patient: one(patients, {
    fields: [chatSessions.patientId],
    references: [patients.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id],
  }),
}));

export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
