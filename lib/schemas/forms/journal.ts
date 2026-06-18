import { z } from "zod";

import { createJournalSchema } from "@/lib/schemas/api/journal";

/**
 * Form-side schema for `Log journal entry` per design.md 6.12:1862 — Title
 * (optional) · Date (default today) · Content (markdown, the main field) ·
 * Linked entities (AI suggests on save). Derived from `createJournalSchema`.
 *
 * Shaping decisions:
 *  - `content` required (NOT NULL, §4:505); `title` optional (§4:504).
 *  - `entryDate` required, defaults to today (browser-local, 2026-06-10).
 *  - `mood` (optional Select of the §4:507 enum) is added beyond §6.12:1862's
 *    draft — the column exists and a one-tap mood enriches the personal-journal
 *    voice; flagged in decisions.md (same call as the Report form's linked
 *    doctor). Empty-string coerces to undefined on the wire.
 *  - `linkedEntities` is NOT a form field — §6.12 marks it "AI suggests on
 *    save" (Phase E); manual entries carry none.
 */
export const journalFormSchema = createJournalSchema.extend({
  entryDate: z.string().min(1, "Required"),
  title: z.string().optional(),
  content: z.string().min(1, "Write something — the entry can't be empty."),
  mood: z.string().optional(),
});

export type JournalFormValues = z.infer<typeof journalFormSchema>;
