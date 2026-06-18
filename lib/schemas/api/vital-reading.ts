import { z } from "zod";

import { vitalContext, vitalFlag, vitalReadingType } from "@/db/schema";

/**
 * Zod schemas for /api/vital-readings — an EVENT entity with a reduced surface:
 * VitalReading has no timeline/detail page in v1 (§6.6 lists five event rail
 * items; vitals aren't one), so there is no PATCH/correction route. Readings are
 * immutable; a mistake is deleted and re-entered (§4:433). Hence only a create
 * schema here plus a DELETE handler that needs no body.
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

export type CreateVitalReadingInput = z.infer<typeof createVitalReadingSchema>;
