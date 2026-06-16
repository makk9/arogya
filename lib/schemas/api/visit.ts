import { z } from "zod";

import { visitStatus, visitType } from "@/db/schema";

/**
 * Zod schemas for /api/visits routes — the first EVENT entity (§6.6/§6.7).
 * Clones the state-entity schema shape (lib/schemas/api/allergy.ts) minus the
 * change-log machinery: events have no `*_changes` table, so there is no
 * change schema and no PATCH-refused clinical-field set — every column is
 * plainly PATCH-able (a Visit row is a record of what happened; corrections
 * edit it in place per §6.7 "Edit toggles in-place editing").
 *
 * No `patientId` in any body — auth-derived via getCurrentPatient() per the
 * 9.6:2755 tripwire.
 *
 * Visit-specific shaping:
 *  - `doctorId` is REQUIRED at create and non-nullable at update — the column
 *    is NOT NULL (§4:346, "a visit without its doctor is clinically
 *    meaningless"; it's also why visits.doctor_id is onDelete:restrict).
 *    Patient scope is checked in the query layer.
 *  - `status` omitted at create → DB default `completed` (§4:356). `scheduled`
 *    is accepted for the pre-visit prep journey ("next visit on Friday").
 *  - `sourceReportId` is NOT exposed — it's written by the Phase E extraction
 *    pipeline, never by direct entry.
 */

const visitTypeEnum = z.enum(visitType.enumValues);
const visitStatusEnum = z.enum(visitStatus.enumValues);

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const uuidSchema = z.string().uuid();

export const createVisitSchema = z
  .object({
    doctorId: uuidSchema,
    visitDate: dateOnlySchema,
    visitType: visitTypeEnum.optional(),
    chiefComplaint: z.string().min(1).optional(),
    summary: z.string().min(1).optional(),
    diagnosisText: z.string().min(1).optional(),
    nextSteps: z.string().min(1).optional(),
    status: visitStatusEnum.optional(),
    notes: z.string().optional(),
  })
  .strict();

export const updateVisitSchema = z
  .object({
    // Non-nullable: NOT NULL columns. Reassigning is allowed; clearing is not.
    doctorId: uuidSchema.optional(),
    visitDate: dateOnlySchema.optional(),
    status: visitStatusEnum.optional(),
    visitType: visitTypeEnum.nullable().optional(),
    chiefComplaint: z.string().min(1).nullable().optional(),
    summary: z.string().min(1).nullable().optional(),
    diagnosisText: z.string().min(1).nullable().optional(),
    nextSteps: z.string().min(1).nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

// `doctor` backs the §6.6 `All doctors ▾` timeline filter pill.
export const listVisitsQuerySchema = z
  .object({
    doctor: uuidSchema.optional(),
  })
  .strict();

export type CreateVisitInput = z.infer<typeof createVisitSchema>;
export type UpdateVisitInput = z.infer<typeof updateVisitSchema>;
