import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  extractionSessions,
  reports,
  type ExtractionSession,
  type NewExtractionSession,
  type Report,
} from "@/db/schema";

/**
 * Query helpers for `extraction_sessions` — the row that connects an uploaded
 * file (its Report) to the extraction agent's output and the confirmation
 * screen (Phase 9.4:2554). Created `pending` by /api/files/process before the
 * agent runs, then moved to `ready_for_confirmation` / `failed`; flipped to
 * `committed` by the E3 confirmation commit. Every lookup is patient-scoped.
 */
export const extractionSessionQueries = {
  async create(values: NewExtractionSession): Promise<ExtractionSession> {
    const [row] = await db
      .insert(extractionSessions)
      .values(values)
      .returning();
    return row;
  },

  // `extractionOutputJson` is untyped jsonb on read — callers (the E3
  // confirmation page) MUST re-validate it with `parseStoredExtractionOutput`
  // (lib/agents/extraction) rather than casting; the DB doesn't enforce the
  // ExtractionOutput shape.
  async getById(
    patientId: string,
    id: string,
  ): Promise<ExtractionSession | null> {
    const rows = await db
      .select()
      .from(extractionSessions)
      .where(
        and(
          eq(extractionSessions.id, id),
          eq(extractionSessions.patientId, patientId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  },

  // Records the extraction outcome — the session's status + output and, on
  // failure, the report's status — in one transaction so the two rows can't
  // diverge (e.g. session "failed" while the report is left "extracting").
  // `reportStatus` is omitted on success (the report stays "extracting" until
  // the E3 commit). `extractionOutputJson` is the Zod-validated ExtractionOutput,
  // or null when the run threw before producing parseable output.
  async recordOutcome(params: {
    sessionId: string;
    reportId: string;
    patientId: string;
    sessionStatus: ExtractionSession["status"];
    reportStatus?: Report["status"];
    extractionOutputJson: unknown;
  }): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(extractionSessions)
        .set({
          status: params.sessionStatus,
          extractionOutputJson: params.extractionOutputJson,
        })
        .where(eq(extractionSessions.id, params.sessionId));
      if (params.reportStatus) {
        await tx
          .update(reports)
          .set({ status: params.reportStatus })
          .where(
            and(
              eq(reports.id, params.reportId),
              eq(reports.patientId, params.patientId),
            ),
          );
      }
    });
  },

  // Status-only transition (e.g. → "committed" at confirmation, or "failed"
  // when the run threw and there's no output to store).
  async setStatus(
    id: string,
    status: ExtractionSession["status"],
  ): Promise<ExtractionSession | null> {
    const [row] = await db
      .update(extractionSessions)
      .set({ status })
      .where(eq(extractionSessions.id, id))
      .returning();
    return row ?? null;
  },

  // Finalizes the E3 confirmation: flips both the session and its Report to
  // "committed" in one transaction once the user has resolved every card
  // (confirmed or discarded). Patient-scoped so a foreign session/report can't
  // be finalized. The individual entity writes happen before this in the commit
  // endpoint; this only marks the source-side bookkeeping done.
  async markCommitted(params: {
    sessionId: string;
    reportId: string;
    patientId: string;
  }): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(extractionSessions)
        .set({ status: "committed" })
        .where(
          and(
            eq(extractionSessions.id, params.sessionId),
            eq(extractionSessions.patientId, params.patientId),
          ),
        );
      await tx
        .update(reports)
        .set({ status: "committed" })
        .where(
          and(
            eq(reports.id, params.reportId),
            eq(reports.patientId, params.patientId),
          ),
        );
    });
  },
};
