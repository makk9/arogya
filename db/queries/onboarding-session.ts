import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  conditions,
  journalEntries,
  medications,
  onboardingSessions,
  vitalReadings,
  type InsightEntityRef,
  type OnboardingMessage,
  type OnboardingPhase,
  type OnboardingSession,
} from "@/db/schema";

/**
 * Onboarding-interview persistence (design.md 5.8 / 6.3) — Phase E item E4.
 *
 * One row per patient (unique index); the row is only conversational position —
 * every captured entity already lives in its real table via the live-
 * transparency writes. Patient-scoped like the other session query layers.
 */

export const onboardingSessionQueries = {
  async getForPatient(patientId: string): Promise<OnboardingSession | null> {
    const rows = await db
      .select()
      .from(onboardingSessions)
      .where(eq(onboardingSessions.patientId, patientId))
      .limit(1);
    return rows[0] ?? null;
  },

  // Lazy singleton — the row is created on the interview's first turn, not on
  // page load (no orphan rows from merely opening the surface). The unique
  // index makes a concurrent double-create resolve to the same row.
  async getOrCreate(patientId: string): Promise<OnboardingSession> {
    const existing = await onboardingSessionQueries.getForPatient(patientId);
    if (existing) return existing;
    const [row] = await db
      .insert(onboardingSessions)
      .values({ patientId })
      .onConflictDoNothing({ target: onboardingSessions.patientId })
      .returning();
    if (row) return row;
    // Conflict path: another request created it between the read and insert.
    const raced = await onboardingSessionQueries.getForPatient(patientId);
    if (!raced) throw new Error("onboarding session upsert failed");
    return raced;
  },

  // Appends one interview turn (user + assistant) to the transcript and, when
  // the agent advanced, bumps the phase. `complete` flips the session's status —
  // the terminal transition the dashboard banner keys off. Single-statement
  // jsonb concat so concurrent turns append rather than clobber (a JS
  // read-modify-write here would let a second tab's turn drop the first).
  async appendTurn(
    patientId: string,
    turn: {
      userText?: string;
      assistantText: string;
      phase?: OnboardingPhase;
    },
  ): Promise<OnboardingSession | null> {
    const newMessages: OnboardingMessage[] = [];
    if (turn.userText && turn.userText.length > 0) {
      newMessages.push({ role: "user", content: turn.userText });
    }
    if (turn.assistantText.length > 0) {
      newMessages.push({ role: "assistant", content: turn.assistantText });
    }
    if (newMessages.length === 0 && !turn.phase) {
      return onboardingSessionQueries.getForPatient(patientId);
    }

    const [row] = await db
      .update(onboardingSessions)
      .set({
        messages: sql`${onboardingSessions.messages} || ${JSON.stringify(newMessages)}::jsonb`,
        ...(turn.phase ? { currentPhase: turn.phase } : {}),
        ...(turn.phase === "complete" ? { status: "completed" as const } : {}),
        updatedAt: new Date(),
      })
      .where(eq(onboardingSessions.patientId, patientId))
      .returning();
    return row ?? null;
  },

  // Trigger ref for the completion-time insight run (§5.6): the most recently
  // created clinical entity in the vault. Needed because the interview's final
  // turn ("we're done") usually commits nothing itself — the entities the run
  // should attribute to arrived in earlier turns. Null on an empty vault, in
  // which case there is nothing to analyze and the caller skips the run.
  async latestClinicalRef(patientId: string): Promise<InsightEntityRef | null> {
    const [med, condition, vital, journal] = await Promise.all([
      db
        .select({ id: medications.id, createdAt: medications.createdAt })
        .from(medications)
        .where(eq(medications.patientId, patientId))
        .orderBy(desc(medications.createdAt))
        .limit(1),
      db
        .select({ id: conditions.id, createdAt: conditions.createdAt })
        .from(conditions)
        .where(eq(conditions.patientId, patientId))
        .orderBy(desc(conditions.createdAt))
        .limit(1),
      db
        .select({ id: vitalReadings.id, createdAt: vitalReadings.createdAt })
        .from(vitalReadings)
        .where(eq(vitalReadings.patientId, patientId))
        .orderBy(desc(vitalReadings.createdAt))
        .limit(1),
      db
        .select({ id: journalEntries.id, createdAt: journalEntries.createdAt })
        .from(journalEntries)
        .where(eq(journalEntries.patientId, patientId))
        .orderBy(desc(journalEntries.createdAt))
        .limit(1),
    ]);

    const candidates: Array<{ type: string; id: string; createdAt: Date }> = [];
    if (med[0]) candidates.push({ type: "med", ...med[0] });
    if (condition[0]) candidates.push({ type: "condition", ...condition[0] });
    if (vital[0]) candidates.push({ type: "vital", ...vital[0] });
    if (journal[0]) candidates.push({ type: "journal", ...journal[0] });
    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { type: candidates[0].type, id: candidates[0].id };
  },
};
