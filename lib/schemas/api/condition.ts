import { z } from "zod";

import {
  conditionCategory,
  conditionSeverity,
  conditionStatus,
} from "@/db/schema";
import { isCalendarDate } from "@/lib/datetime";

/**
 * Zod schemas for /api/conditions routes. Clones lib/schemas/api/medication.ts.
 *
 * No `patientId` in any body — auth-derived via getCurrentPatient() per the
 * 9.6:2755 tripwire.
 *
 * Two deliberate divergences from the Medication template (the Condition state
 * model is richer; see the approved plan / decisions.md):
 *  - `notes` is a plain PATCH-editable field, NOT change-logged. The
 *    condition_changes.field enum's "notes" value is intentionally unused in v1.
 *  - All status transitions flow through /changes (no /resolve route), and
 *    condition_changes has no linked_visit_id column — so no `linkedVisitId`
 *    anywhere here (Medication's change schema carries it).
 *
 * Update schema excludes the three change-logged fields (status / severity /
 * managingDoctor). Per-field rejection guidance is surfaced by the PATCH route,
 * not the schema. .strict() is a safety net for any other unknown key.
 *
 * Enum value-sets derive from the Drizzle pgEnums (single source of truth).
 */

const conditionCategoryEnum = z.enum(conditionCategory.enumValues);
const conditionStatusEnum = z.enum(conditionStatus.enumValues);
const conditionSeverityEnum = z.enum(conditionSeverity.enumValues);

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .refine(isCalendarDate, "Not a real calendar date");

const uuidSchema = z.string().uuid();

/**
 * Create accepts the change-logged fields (status / severity / managingDoctor)
 * directly — at create-time there is no prior value to log, exactly as
 * Medication-create accepts prescribingDoctor. Semantics of an omitted field:
 *  - status omitted        → "active" (DB column default)
 *  - severity omitted      → null  ("severity not yet assessed")
 *  - managingDoctor omitted → null ("no managing doctor assigned yet")
 *  - diagnosedBy omitted   → null  ("diagnosing doctor unknown / pre-app")
 */
export const createConditionSchema = z
  .object({
    name: z.string().min(1),
    status: conditionStatusEnum.optional(),
    category: conditionCategoryEnum.optional(),
    icdCode: z.string().min(1).optional(),
    severity: conditionSeverityEnum.optional(),
    diagnosedOn: dateOnlySchema.optional(),
    diagnosedBy: uuidSchema.optional(),
    managingDoctor: uuidSchema.optional(),
    notes: z.string().optional(),
  })
  .strict();

export const updateConditionSchema = z
  .object({
    name: z.string().min(1).optional(),
    category: conditionCategoryEnum.nullable().optional(),
    icdCode: z.string().min(1).nullable().optional(),
    diagnosedOn: dateOnlySchema.nullable().optional(),
    diagnosedBy: uuidSchema.nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

// Discriminated union on `field` — newValue's shape varies per branch:
// status / severity are constrained to their pgEnum value-sets (not free text,
// unlike Medication's dose/frequency); managing_doctor is a uuid.
//
// Shared base (reason / changedAt) sits in conditionChangeBase. There is NO
// linkedVisitId — condition_changes has no such column. The route reparses the
// body with this schema after the path-uuid + JSON checks, so failure surfaces
// with the standard flatten()'d details payload.
const conditionChangeBase = z.object({
  reason: z.string().min(1).optional(),
  changedAt: dateOnlySchema.optional(),
});

export const createConditionChangeSchema = z.discriminatedUnion("field", [
  conditionChangeBase.extend({
    field: z.literal("status"),
    newValue: conditionStatusEnum,
  }),
  conditionChangeBase.extend({
    field: z.literal("severity"),
    newValue: conditionSeverityEnum,
  }),
  conditionChangeBase.extend({
    field: z.literal("managing_doctor"),
    newValue: uuidSchema,
  }),
]);

export const listConditionsQuerySchema = z
  .object({
    status: conditionStatusEnum.optional(),
  })
  .strict();

export type CreateConditionInput = z.infer<typeof createConditionSchema>;
export type UpdateConditionInput = z.infer<typeof updateConditionSchema>;
export type CreateConditionChangeInput = z.infer<
  typeof createConditionChangeSchema
>;
