import { z } from "zod";

// POST /api/onboarding — one interview turn. `message` absent means the opening
// turn (the agent greets and begins phase 1) or a resume nudge; it is not
// persisted to the transcript in that case.
export const onboardingTurnRequestSchema = z
  .object({
    message: z.string().min(1).max(4000).optional(),
  })
  .strict();

export type OnboardingTurnRequest = z.infer<typeof onboardingTurnRequestSchema>;
