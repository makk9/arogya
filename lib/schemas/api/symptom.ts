import { z } from "zod";

import {
  symptomBodyArea,
  symptomEpisodeSeverity,
  symptomStatus,
} from "@/db/schema";

/**
 * Zod schemas for /api/symptom-types and /api/symptom-episodes — the third EVENT
 * entity (§6.6/§6.7), inverted one→many: the SymptomEpisode (child) is the
 * timestamped event with the timeline card + detail page, the SymptomType
 * (parent) is the stable identity with a state-style detail page.
 *
 * No `patientId` in any body — auth-derived via getCurrentPatient() (9.6:2755).
 *
 * Symptom-specific shaping:
 *  - An episode is created WITH its type: the body sends either an existing
 *    `symptomTypeId` OR a `newType` to create inline ("+ Create new" on the
 *    §6.12 autocomplete). Exactly one — enforced by refine.
 *  - The TYPE has no create route (types are born from episodes); it has only
 *    PATCH (state-detail inline edit) + DELETE. `name` is the identity, so it's
 *    non-nullable at update; everything else clears to null.
 *  - `started_at` / `ended_at` are timestamptz (the episode's clock matters);
 *    the form sends `new Date(local).toISOString()`. `first_noted` is date-only.
 *  - `linked_vital_ids` is an array of existing reading ids — set at create AND
 *    editable post-hoc on the episode detail (replace-whole-array semantics).
 *    `source_report_id` / `recorded_by` are extraction/auth-set, never direct entry.
 */

const bodyAreaEnum = z.enum(symptomBodyArea.enumValues);
const statusEnum = z.enum(symptomStatus.enumValues);
const severityEnum = z.enum(symptomEpisodeSeverity.enumValues);

const uuidSchema = z.string().uuid();
const isoDatetime = z.string().datetime({ offset: true });
const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

// ---- SymptomType ------------------------------------------------------------

// PATCH only — `name` reassignable but not clearable (identity); the rest clear.
export const updateSymptomTypeSchema = z
  .object({
    name: z.string().min(1).optional(),
    bodyArea: bodyAreaEnum.nullable().optional(),
    linkedCondition: uuidSchema.nullable().optional(),
    firstNoted: dateOnlySchema.nullable().optional(),
    status: statusEnum.optional(),
    notes: z.string().min(1).nullable().optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

// ---- SymptomEpisode ---------------------------------------------------------

// Inline type creation when the user picks "+ Create new".
const newTypeSchema = z
  .object({
    name: z.string().min(1),
    bodyArea: bodyAreaEnum.optional(),
  })
  .strict();

export const createSymptomEpisodeSchema = z
  .object({
    // Exactly one of these resolves the parent type (refine below).
    symptomTypeId: uuidSchema.optional(),
    newType: newTypeSchema.optional(),

    startedAt: isoDatetime,
    endedAt: isoDatetime.optional(),
    durationMinutes: z.number().int().positive().optional(),
    severity: severityEnum.optional(),
    description: z.string().min(1).optional(),
    triggers: z.string().min(1).optional(),
    relief: z.string().min(1).optional(),
    linkedVitalIds: z.array(uuidSchema).optional(),
    linkedVisitId: uuidSchema.optional(),
    notes: z.string().min(1).optional(),
  })
  .strict()
  .refine((b) => (b.symptomTypeId === undefined) !== (b.newType === undefined), {
    message: "Provide exactly one of symptomTypeId or newType.",
    path: ["symptomTypeId"],
  })
  // ended_at before started_at would render a negative span — reject it.
  .refine((b) => b.endedAt === undefined || b.endedAt >= b.startedAt, {
    message: "End time can't be before the start time.",
    path: ["endedAt"],
  });

export const updateSymptomEpisodeSchema = z
  .object({
    startedAt: isoDatetime.optional(),
    endedAt: isoDatetime.nullable().optional(),
    durationMinutes: z.number().int().positive().nullable().optional(),
    severity: severityEnum.nullable().optional(),
    description: z.string().min(1).nullable().optional(),
    triggers: z.string().min(1).nullable().optional(),
    relief: z.string().min(1).nullable().optional(),
    linkedVitalIds: z.array(uuidSchema).nullable().optional(),
    linkedVisitId: uuidSchema.nullable().optional(),
    notes: z.string().min(1).nullable().optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateSymptomTypeInput = z.infer<typeof updateSymptomTypeSchema>;
export type CreateSymptomEpisodeInput = z.infer<
  typeof createSymptomEpisodeSchema
>;
export type UpdateSymptomEpisodeInput = z.infer<
  typeof updateSymptomEpisodeSchema
>;
