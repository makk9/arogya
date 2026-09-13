import { z } from "zod";

import { reportType } from "@/db/schema";
import { isCalendarDate } from "@/lib/datetime";

/**
 * Zod schemas for /api/reports routes — an EVENT entity (§6.6/§6.7). Clones the
 * Visit event shape (lib/schemas/api/visit.ts) minus the change-log machinery:
 * events have no `*_changes` table, so every column is plainly PATCH-able (a
 * Report row records a document; corrections edit it in place per §6.7 "Edit
 * toggles in-place editing").
 *
 * No `patientId` in any body — auth-derived via getCurrentPatient() (9.6:2755).
 *
 * Report-specific shaping:
 *  - `title` and `reportDate` are REQUIRED at create and non-nullable at update
 *    (both NOT NULL: §4:485/487). Reassigning is allowed; clearing is not.
 *  - `reportType` is the §4:486 enum (discharge_summary / doctor_letter /
 *    prescription / insurance / imaging / other), backing the §6.6 `All types ▾`
 *    filter. Optional — a document may not slot a type.
 *  - `linkedVisitId` / `linkedDoctorId` are the two optional FK references the
 *    report carries ("came from this visit" / "authored by this doctor",
 *    §4:490/491). Patient scope is checked in the query layer.
 *  - `sourceFileUrl` is NOT exposed and `status` is NOT exposed — both belong to
 *    the Phase E upload/extraction pipeline (status defaults `ready` at direct
 *    entry; the file-handling fields are written by /api/files/process, never by
 *    direct entry — same exclusion as Visit/Lab `sourceReportId`).
 */

const reportTypeEnum = z.enum(reportType.enumValues);

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .refine(isCalendarDate, "Not a real calendar date");

const uuidSchema = z.string().uuid();

export const createReportSchema = z
  .object({
    title: z.string().min(1),
    reportDate: dateOnlySchema,
    reportType: reportTypeEnum.optional(),
    linkedVisitId: uuidSchema.optional(),
    linkedDoctorId: uuidSchema.optional(),
    content: z.string().min(1).optional(),
    notes: z.string().min(1).optional(),
  })
  .strict();

export const updateReportSchema = z
  .object({
    // Non-nullable: NOT NULL columns. Reassigning is allowed; clearing is not.
    title: z.string().min(1).optional(),
    reportDate: dateOnlySchema.optional(),
    reportType: reportTypeEnum.nullable().optional(),
    linkedVisitId: uuidSchema.nullable().optional(),
    linkedDoctorId: uuidSchema.nullable().optional(),
    content: z.string().min(1).nullable().optional(),
    notes: z.string().min(1).nullable().optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

// `reportType` backs the §6.6 `All types ▾` timeline filter pill (param name
// matches the Lab API's `?reportType=` — both event entities filter on their
// report-type column under the same query key).
export const listReportsQuerySchema = z
  .object({
    reportType: reportTypeEnum.optional(),
  })
  .strict();

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
