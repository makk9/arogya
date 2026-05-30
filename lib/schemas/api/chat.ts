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
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
