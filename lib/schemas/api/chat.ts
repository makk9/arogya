import { z } from "zod";

/**
 * POST /api/chat request schema.
 *
 * No `patientId` — derived from `getCurrentPatient()` per design.md 9.6:2755
 * (single-patient v1; v1.5 swap stays inside the auth helper).
 *
 * `messages` is loosely typed here: role + opaque `parts`. The client sends
 * UIMessages (the shape `useChat` produces — `{ id, role, parts }`), which the
 * route bridges to ModelMessages via `convertToModelMessages`. That helper does
 * the strict shape validation downstream; the route's job at the boundary is
 * "is this even a chat request," not re-deriving the SDK's union.
 */

const messageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(["system", "user", "assistant"]),
  parts: z.array(z.unknown()),
});

export const chatRequestSchema = z.object({
  messages: z.array(messageSchema).min(1),
  surfaceContext: z.string().min(1).optional(),
  // Present when the message comes from a persisted full-screen session (E0b):
  // the route persists the user turn + assistant reply against it. Absent for
  // the ephemeral Ask-AI drawer, which keeps its conversation in memory only.
  sessionId: z.string().uuid().optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

// PATCH /api/chat/sessions/[sessionId] — user rename via the … session menu
// (6.2:1193). Title is the only mutable field; messages are append-only.
export const renameChatSessionSchema = z.object({
  title: z.string().trim().min(1).max(120),
});

export type RenameChatSessionRequest = z.infer<typeof renameChatSessionSchema>;

// POST /api/chat/classify — the quick-log router (§5.5) running on every typed
// chat input. Returns the intent so the client can branch: question → synthesis,
// log → quick-log extraction, ambiguous → inline disambiguator.
export const classifyRequestSchema = z.object({
  input: z.string().min(1).max(4000),
});

export type ClassifyRequest = z.infer<typeof classifyRequestSchema>;

// POST /api/chat/quick-log — free-text log path (§5.4 text-input mode). The text
// is the extraction source; it lands on the §6.11 confirmation screen, never
// auto-written.
export const quickLogRequestSchema = z.object({
  text: z.string().min(1).max(4000),
});

export type QuickLogRequest = z.infer<typeof quickLogRequestSchema>;
