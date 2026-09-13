import { z } from "zod";

import { allergyCategory, allergySeverity, allergyStatus } from "@/db/schema";
import { isCalendarDate } from "@/lib/datetime";

/**
 * Zod schemas for /api/allergies routes. Clones lib/schemas/api/condition.ts.
 *
 * No `patientId` in any body — auth-derived via getCurrentPatient() per the
 * 9.6:2755 tripwire.
 *
 * Allergy-specific shaping:
 *  - `category` is REQUIRED at create and non-nullable at update — the column is
 *    NOT NULL with no default (§4:259, "Scopes AI risk reasoning"). §6.12:1848
 *    marks only Substance with an asterisk, but the locked Phase 4 schema wins;
 *    deviation surfaced in decisions.md.
 *  - `severity` omitted at create → the DB default `unknown` applies (§4:261
 *    "Defaults unknown when absent") — unlike Condition, where omitted severity
 *    stores null ("not yet assessed").
 *  - Change-logged fields are status + severity only (§6.5:1402 History axes);
 *    the update schema excludes them. `confirmedBy` is plain PATCH-editable
 *    (like Condition's diagnosedBy) — patient-scope-checked in the query layer.
 */

const allergyCategoryEnum = z.enum(allergyCategory.enumValues);
const allergyStatusEnum = z.enum(allergyStatus.enumValues);
const allergySeverityEnum = z.enum(allergySeverity.enumValues);

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .refine(isCalendarDate, "Not a real calendar date");

const uuidSchema = z.string().uuid();

/**
 * Create accepts the change-logged fields (status / severity) directly — at
 * create-time there is no prior value to log. Semantics of an omitted field:
 *  - status omitted      → "active" (DB column default)
 *  - severity omitted    → "unknown" (DB column default; §4:261)
 *  - confirmedBy omitted → null (patient-reported, no confirming doctor; §4:263)
 */
export const createAllergySchema = z
  .object({
    substance: z.string().min(1),
    category: allergyCategoryEnum,
    reaction: z.string().min(1).optional(),
    severity: allergySeverityEnum.optional(),
    firstNoted: dateOnlySchema.optional(),
    confirmedBy: uuidSchema.optional(),
    status: allergyStatusEnum.optional(),
    notes: z.string().optional(),
  })
  .strict();

export const updateAllergySchema = z
  .object({
    substance: z.string().min(1).optional(),
    // Non-nullable: the column is NOT NULL. Recategorizing is allowed; clearing
    // is not.
    category: allergyCategoryEnum.optional(),
    reaction: z.string().min(1).nullable().optional(),
    firstNoted: dateOnlySchema.nullable().optional(),
    confirmedBy: uuidSchema.nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

// Discriminated union on `field` — status / severity are constrained to their
// pgEnum value-sets. Shared base (reason / changedAt) sits in allergyChangeBase.
// No linkedVisitId (allergy_changes has no such column, same as Condition).
const allergyChangeBase = z.object({
  reason: z.string().min(1).optional(),
  changedAt: dateOnlySchema.optional(),
});

export const createAllergyChangeSchema = z.discriminatedUnion("field", [
  allergyChangeBase.extend({
    field: z.literal("status"),
    newValue: allergyStatusEnum,
  }),
  allergyChangeBase.extend({
    field: z.literal("severity"),
    newValue: allergySeverityEnum,
  }),
]);

export const listAllergiesQuerySchema = z
  .object({
    status: allergyStatusEnum.optional(),
  })
  .strict();

export type CreateAllergyInput = z.infer<typeof createAllergySchema>;
export type UpdateAllergyInput = z.infer<typeof updateAllergySchema>;
export type CreateAllergyChangeInput = z.infer<
  typeof createAllergyChangeSchema
>;
