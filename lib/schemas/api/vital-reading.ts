import { z } from "zod";

import { vitalContext, vitalFlag, vitalReadingType } from "@/db/schema";

/**
 * Zod schemas for /api/vital-readings — an EVENT entity with a reduced surface:
 * VitalReading has no timeline/detail page in v1 (§6.6 lists five event rail
 * items; vitals aren't one). Readings are corrected in place from the vitals
 * history table (PATCH, no change log — same as a lab marker correction;
 * decisions.md 2026-09-13 supersedes §4:433's delete-and-re-enter rule).
 *
 * No `patientId` in the body — auth-derived via getCurrentPatient() (9.6:2755).
 *
 * Vital-specific shaping:
 *  - `recordedAt` is a full ISO-8601 datetime (timestamptz — morning-vs-evening
 *    matters clinically, §4:419/430). The form sends `new Date(local).toISOString()`.
 *  - `valuePrimary` / `valueSecondary` are numeric (string over the wire per
 *    Drizzle); secondary is the BP diastolic, null for single-number readings.
 *  - `flag` is computed at log time against the patient's reference range
 *    (§4:424); v1 has no reference store, so the user sets it directly on the form.
 *  - `linkedSymptomId` is accepted (the reverse of the episode→vitals link) and
 *    scope-checked, but the v1 form doesn't expose it — episodes own the link via
 *    `linked_vital_ids` (§4:466). `source_report_id` is extraction-only (Phase E).
 */

const readingTypeEnum = z.enum(vitalReadingType.enumValues);
const contextEnum = z.enum(vitalContext.enumValues);
const flagEnum = z.enum(vitalFlag.enumValues);

const uuidSchema = z.string().uuid();

// numeric columns round-trip as strings through Drizzle. Accept a plain decimal
// string; the form sends "" → undefined (omitted), never an empty numeric.
const numericStringSchema = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, "Must be a number");

export const createVitalReadingSchema = z
  .object({
    readingType: readingTypeEnum,
    recordedAt: z.string().datetime({ offset: true }),
    valuePrimary: numericStringSchema.optional(),
    valueSecondary: numericStringSchema.optional(),
    unit: z.string().min(1),
    context: contextEnum.optional(),
    flag: flagEnum.optional(),
    linkedSymptomId: uuidSchema.optional(),
    notes: z.string().min(1).optional(),
  })
  .strict()
  // A reading with no number at all is meaningless; require at least the primary.
  .refine((r) => r.valuePrimary !== undefined, {
    message: "A reading needs at least one value.",
    path: ["valuePrimary"],
  })
  // valueSecondary without valuePrimary would render as "—/80", nonsense.
  .refine((r) => !(r.valueSecondary !== undefined && r.valuePrimary === undefined), {
    message: "A secondary value needs a primary value too.",
    path: ["valueSecondary"],
  });

// PATCH — in-place correction of a logged reading (decisions.md 2026-09-13,
// superseding §4:433's immutability). `readingType` is the reading's identity
// (and its citation slug's type segment), so it isn't correctable — a reading
// logged under the wrong type is deleted and re-entered. The primary value and
// unit are required on the row, so they can change but not clear; the rest
// clear to null.
export const updateVitalReadingSchema = z
  .object({
    recordedAt: z.string().datetime({ offset: true }).optional(),
    valuePrimary: numericStringSchema.optional(),
    valueSecondary: numericStringSchema.nullable().optional(),
    unit: z.string().min(1).optional(),
    context: contextEnum.nullable().optional(),
    flag: flagEnum.nullable().optional(),
    notes: z.string().min(1).nullable().optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

export type CreateVitalReadingInput = z.infer<typeof createVitalReadingSchema>;
export type UpdateVitalReadingInput = z.infer<typeof updateVitalReadingSchema>;
