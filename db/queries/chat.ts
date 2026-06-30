import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  chatMessages,
  chatSessions,
  type ChatMessage,
  type ChatSession,
} from "@/db/schema";

/**
 * Chat-session persistence helpers (design.md 6.2) — Phase E item E0b.
 *
 * Every read/write takes `patientId` explicitly and scopes on it (the v1
 * patient-scoping pattern, 9.2:2315). A session id alone never grants access —
 * the API layer always pairs it with the auth-derived patient so one record's
 * conversations can't be reached from another's.
 */

export const chatQueries = {
  // Starts an untitled session. Title is filled in by auto-titling (E6) after
  // the first AI reply; the surface renders a fallback until then.
  async createSession(patientId: string): Promise<ChatSession> {
    const [row] = await db
      .insert(chatSessions)
      .values({ patientId })
      .returning();
    return row;
  },

  // History list (CHATS column), most-recently-active first.
  async listSessions(patientId: string): Promise<ChatSession[]> {
    return db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.patientId, patientId))
      .orderBy(desc(chatSessions.updatedAt));
  },

  // Patient-scoped fetch — the ownership gate for every session-targeted op.
  async getSession(
    patientId: string,
    sessionId: string,
  ): Promise<ChatSession | null> {
    const rows = await db
      .select()
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.patientId, patientId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  },

  // Conversation transcript in send order. Self-scoping: the inner join to
  // chat_sessions filters on patient_id, so a foreign/stale sessionId returns []
  // rather than another patient's messages — the method can't leak on its own,
  // independent of the caller also having checked getSession.
  //
  // Ordering: createdAt asc, with a role tiebreak (user before assistant) so a
  // turn renders correctly even in the degenerate case where the two rows share
  // a createdAt. The turn's two inserts run in separate transactions (distinct
  // now()), so this tiebreak is a belt-and-suspenders guarantee, not the primary
  // ordering.
  async getMessages(
    patientId: string,
    sessionId: string,
  ): Promise<ChatMessage[]> {
    return db
      .select({
        id: chatMessages.id,
        sessionId: chatMessages.sessionId,
        role: chatMessages.role,
        content: chatMessages.content,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
      .where(
        and(
          eq(chatMessages.sessionId, sessionId),
          eq(chatSessions.patientId, patientId),
        ),
      )
      .orderBy(
        asc(chatMessages.createdAt),
        sql`case when ${chatMessages.role} = 'user' then 0 else 1 end`,
      );
  },

  // Appends a turn and bumps the parent session's updatedAt so the history list
  // re-sorts to most-recent. Single transaction — the message and the touch land
  // together. Caller has already verified the session is in patient scope.
  async addMessage(
    sessionId: string,
    role: ChatMessage["role"],
    content: string,
  ): Promise<ChatMessage> {
    return db.transaction(async (tx) => {
      const [row] = await tx
        .insert(chatMessages)
        .values({ sessionId, role, content })
        .returning();
      await tx
        .update(chatSessions)
        .set({ updatedAt: new Date() })
        .where(eq(chatSessions.id, sessionId));
      return row;
    });
  },

  // User-initiated rename (the … session menu, 6.2:1193). Patient-scoped.
  async renameSession(
    patientId: string,
    sessionId: string,
    title: string,
  ): Promise<ChatSession | null> {
    const [row] = await db
      .update(chatSessions)
      .set({ title })
      .where(
        and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.patientId, patientId),
        ),
      )
      .returning();
    return row ?? null;
  },

  // Auto-titling (E6) write. Only sets the title when still null so a fire-and-
  // forget titling call can never clobber a user's manual rename, even if it
  // lands late. Returns whether it set anything.
  async setTitleIfNull(sessionId: string, title: string): Promise<boolean> {
    const rows = await db
      .update(chatSessions)
      .set({ title })
      .where(and(eq(chatSessions.id, sessionId), isNull(chatSessions.title)))
      .returning({ id: chatSessions.id });
    return rows.length > 0;
  },

  // Cascade drops the session's messages (FK onDelete cascade). Patient-scoped.
  async deleteSession(patientId: string, sessionId: string): Promise<boolean> {
    const rows = await db
      .delete(chatSessions)
      .where(
        and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.patientId, patientId),
        ),
      )
      .returning({ id: chatSessions.id });
    return rows.length > 0;
  },
};
