import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { conditions, doctors, symptomEpisodes, symptomTypes, visits } from "@/db/schema";

/**
 * Patient-scope existence checks for cross-entity FK targets, shared across
 * query helpers. Used to validate that a referenced doctor / condition / visit
 * belongs to the same patient *before* an insert or change — both to return a
 * 400 (not a Postgres FK-violation 500) and to keep one patient's records from
 * referencing another's (immaterial in single-patient v1, but the guard rail
 * matters and the FK constraint alone doesn't enforce patient scope).
 *
 * Reads use the base `db` connection, not a transaction handle: these are
 * existence reads of rows this operation isn't mutating, so reading committed
 * data outside the caller's tx is correct, and the FK constraint remains the
 * ultimate backstop against a delete racing the check.
 */

export async function doctorInScope(
  patientId: string,
  doctorId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: doctors.id })
    .from(doctors)
    .where(and(eq(doctors.id, doctorId), eq(doctors.patientId, patientId)))
    .limit(1);
  return row !== undefined;
}

export async function conditionInScope(
  patientId: string,
  conditionId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: conditions.id })
    .from(conditions)
    .where(and(eq(conditions.id, conditionId), eq(conditions.patientId, patientId)))
    .limit(1);
  return row !== undefined;
}

export async function visitInScope(
  patientId: string,
  visitId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: visits.id })
    .from(visits)
    .where(and(eq(visits.id, visitId), eq(visits.patientId, patientId)))
    .limit(1);
  return row !== undefined;
}

export async function symptomTypeInScope(
  patientId: string,
  symptomTypeId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: symptomTypes.id })
    .from(symptomTypes)
    .where(
      and(eq(symptomTypes.id, symptomTypeId), eq(symptomTypes.patientId, patientId)),
    )
    .limit(1);
  return row !== undefined;
}

export async function symptomEpisodeInScope(
  patientId: string,
  episodeId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: symptomEpisodes.id })
    .from(symptomEpisodes)
    .where(
      and(eq(symptomEpisodes.id, episodeId), eq(symptomEpisodes.patientId, patientId)),
    )
    .limit(1);
  return row !== undefined;
}
