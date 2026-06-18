import { z } from "zod";

import { journalMood } from "@/db/schema";

/**
 * Zod schemas for /api/journal routes — the leanest EVENT entity (§6.6/§6.7).
 * Clones the event shape (lib/schemas/api/report.ts) minus every cross-entity
 * concern: a journal entry has no linked FKs and no report-type, just a dated
 * markdown body + optional title + optional mood.
 *
 * No `patientId` in any body — auth-derived via getCurrentPatient() (9.6:2755).
 *
 * Journal-specific shaping:
 *  - `content` is REQUIRED at create and non-nullable at update (NOT NULL,
 *    §4:505 — the body IS the entry). `title` is optional/nullable (§4:504 —
 *    "entries can be title-less", rendered `(untitled)`).
 *  - `entryDate` ("Day the entry is about", §4:503) required, defaults to today
 *    in the form (browser-local per the 2026-06-10 form-date-default decision).
 *  - `mood` is the §4:507 enum, optional/nullable.
 *  - `linkedEntities` is NOT exposed — §6.12:1862 "Linked entities (AI suggests
 *    on save)": the jsonb refs are written by the Phase E onboarding/extraction/
 *    synthesis tagging path, never by direct entry (same exclusion as
 *    `sourceReportId`).
 *  - No list-filter schema: the §6.6:1451 Journal timeline has no filter pill.
 */

const moodEnum = z.enum(journalMood.enumValues);

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const createJournalSchema = z
  .object({
    entryDate: dateOnlySchema,
    title: z.string().min(1).optional(),
    content: z.string().min(1),
    mood: moodEnum.optional(),
  })
  .strict();

export const updateJournalSchema = z
  .object({
    entryDate: dateOnlySchema.optional(),
    // title / mood clear to null; content is non-nullable (NOT NULL column).
    title: z.string().min(1).nullable().optional(),
    content: z.string().min(1).optional(),
    mood: moodEnum.nullable().optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

export type CreateJournalInput = z.infer<typeof createJournalSchema>;
export type UpdateJournalInput = z.infer<typeof updateJournalSchema>;
