import { z } from "zod";

import { insightStatus } from "@/db/schema";

/**
 * Zod schema for PATCH /api/insights/[id]. The AI-authored fields are immutable;
 * two user-facing fields mutate — the status lifecycle (§4:583 + §6.9:1607) and
 * the editorial `notes` (§6.9:1629). The body accepts those (plus the optional
 * `dismissedReason`) and nothing else. No `patientId` (auth-derived per the
 * 9.6:2755 tripwire).
 *
 * At least one of `status` / `notes` must be present (an empty PATCH is a no-op
 * worth rejecting). Status: any → any is allowed (§6.9 action buttons + Restore;
 * the lifecycle has no side-effecting terminal states). `dismissedReason` only
 * makes sense with a `dismissed` status — the superRefine rejects it otherwise
 * (a teaching-surface rejection, not a silent drop). `notes` is nullable
 * (clearing the field) and length-capped.
 */
const insightStatusEnum = z.enum(insightStatus.enumValues);

export const updateInsightSchema = z
  .object({
    status: insightStatusEnum.optional(),
    dismissedReason: z.string().min(1).max(500).optional(),
    notes: z.string().max(5000).nullable().optional(),
  })
  .strict()
  .refine((val) => val.status !== undefined || val.notes !== undefined, {
    message: "Provide a status or notes to update.",
  })
  .superRefine((val, ctx) => {
    if (val.dismissedReason !== undefined && val.status !== "dismissed") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dismissedReason"],
        message: "A reason can only accompany a 'dismissed' status.",
      });
    }
  });

export type UpdateInsightInput = z.infer<typeof updateInsightSchema>;
