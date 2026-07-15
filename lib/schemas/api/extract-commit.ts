import { z } from "zod";

/**
 * Request schema for POST /api/extract/[sessionId]/commit — the E3 confirmation
 * commit (§6.11). The client sends only the cards it is committing (one card for
 * a per-card `Confirm`, all remaining for `Confirm all · N`), each carrying the
 * user-resolved `data` (extracted_data after inline edits + ambiguity chips),
 * the chosen new-vs-update `mode`, and the matched entity for updates.
 *
 * `data` keeps the extraction agent's snake_case field names (§5.4:763) — the
 * server-side commit mapper (lib/extraction/commit.ts) translates them to the
 * per-entity insert shapes. Values are re-validated there against the real
 * column/enum constraints; the surface is human-in-the-loop, so edited values
 * are trusted for *content* but never for *shape*.
 *
 * `finalize` is set by the client when this commit clears the last pending card,
 * so the endpoint flips the session + report to `committed` in the same request
 * (no separate "done" round-trip, no orphaned `ready_for_confirmation` row).
 */

// The eight entity types the extraction agent can emit (§5.4:37-45).
export const commitEntityType = z.enum([
  "medication",
  "condition",
  "doctor",
  "allergy",
  "lab_report",
  "vital_reading",
  "visit",
  "symptom_episode",
]);
export type CommitEntityType = z.infer<typeof commitEntityType>;

export const commitCardSchema = z.object({
  targetEntityType: commitEntityType,
  mode: z.enum(["create", "update"]),
  matchedEntityId: z.string().uuid().nullable(),
  data: z.record(z.string(), z.unknown()),
});
export type CommitCardInput = z.infer<typeof commitCardSchema>;

export const commitRequestSchema = z
  .object({
    cards: z.array(commitCardSchema).min(1).max(50),
    finalize: z.boolean().default(false),
    // The chat session the log originated from. When present and this request
    // finalizes, the commit writes a "Logged ✓" assistant turn back to that
    // conversation (§6.2:1197) so returning to the chat shows what happened.
    chatSessionId: z.string().uuid().optional(),
  })
  .strict();
export type CommitRequestInput = z.infer<typeof commitRequestSchema>;
