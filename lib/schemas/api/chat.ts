import { z } from "zod";

/**
 * POST /api/chat request schema.
 *
 * No `patientId` — derived from `getCurrentPatient()` per design.md 9.6:2755
 * (single-patient v1; v1.5 swap stays inside the auth helper).
 *
 * `messages` is loosely typed here: role + opaque content. The Vercel AI SDK
 * does strict ModelMessage validation downstream; the route's job at the
 * boundary is "is this even a chat request," not re-deriving the SDK's union.
 */

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.unknown(),
});

export const chatRequestSchema = z.object({
  messages: z.array(messageSchema).min(1),
  surfaceContext: z.string().min(1).optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
