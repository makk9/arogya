import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  medicationChanges,
  medications,
  medicationStatus,
  type Medication,
  type MedicationChange,
  type NewMedication,
} from "@/db/schema";
import { todayInTimezone } from "@/lib/datetime";

type MedicationStatus = (typeof medicationStatus.enumValues)[number];

type MedicationUpdate = Partial<
  Pick<
    NewMedication,
    "name" | "brandName" | "form" | "purpose" | "category" | "startedOn" | "notes"
  >
>;

export class MedicationDomainError extends Error {
  constructor(
    public readonly kind: "not_found" | "already_discontinued",
    public readonly meta?: {
      currentStatus?: MedicationStatus;
      discontinuedOn?: string | null;
    },
  ) {
    super(kind);
    this.name = "MedicationDomainError";
  }
}

export const medicationQueries = {
  async forPatient(patientId: string): Promise<Medication[]> {
    return db
      .select()
      .from(medications)
      .where(eq(medications.patientId, patientId))
      .orderBy(desc(medications.createdAt));
  },

  async byStatus(
    patientId: string,
    status: MedicationStatus,
  ): Promise<Medication[]> {
    return db
      .select()
      .from(medications)
      .where(
        and(
          eq(medications.patientId, patientId),
          eq(medications.status, status),
        ),
      )
      .orderBy(desc(medications.createdAt));
  },

  // Convenience alias used by serializers. Kept on top of byStatus so renaming
  // call sites is unnecessary.
  async active(patientId: string): Promise<Medication[]> {
    return medicationQueries.byStatus(patientId, "active");
  },

  async getById(
    patientId: string,
    id: string,
  ): Promise<Medication | null> {
    const rows = await db
      .select()
      .from(medications)
      .where(and(eq(medications.id, id), eq(medications.patientId, patientId)))
      .limit(1);
    return rows[0] ?? null;
  },

  async create(values: NewMedication): Promise<Medication> {
    const [row] = await db.insert(medications).values(values).returning();
    return row;
  },

  async update(
    patientId: string,
    id: string,
    values: MedicationUpdate,
  ): Promise<Medication | null> {
    const [row] = await db
      .update(medications)
      .set(values)
      .where(and(eq(medications.id, id), eq(medications.patientId, patientId)))
      .returning();
    return row ?? null;
  },

  async delete(patientId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(medications)
      .where(and(eq(medications.id, id), eq(medications.patientId, patientId)))
      .returning({ id: medications.id });
    return result.length > 0;
  },

  // Transactional: read current → insert change-log → update row. Throws
  // MedicationDomainError("not_found") if no such med for this patient, or
  // ("already_discontinued", meta) if status is already "discontinued".
  //
  // `timezone` is the patient's IANA tz per design.md 9.6:2803 — discontinuedOn
  // is computed in that zone so a Pune-evening action doesn't record yesterday's
  // UTC date. Forward callers: thread timezone from getCurrentPatient().
  async discontinue(
    patientId: string,
    id: string,
    opts: { reason: string; linkedVisitId?: string; timezone: string },
  ): Promise<Medication> {
    return db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(medications)
        .where(
          and(eq(medications.id, id), eq(medications.patientId, patientId)),
        )
        .limit(1);

      if (!current) {
        throw new MedicationDomainError("not_found");
      }
      if (current.status === "discontinued") {
        throw new MedicationDomainError("already_discontinued", {
          currentStatus: current.status,
          discontinuedOn: current.discontinuedOn,
        });
      }

      await tx.insert(medicationChanges).values({
        medicationId: id,
        field: "status",
        oldValue: current.status,
        newValue: "discontinued",
        reason: opts.reason,
        linkedVisitId: opts.linkedVisitId ?? null,
      });

      const today = todayInTimezone(opts.timezone);

      const [updated] = await tx
        .update(medications)
        .set({
          status: "discontinued",
          discontinuedOn: today,
          discontinuationReason: opts.reason,
        })
        .where(eq(medications.id, id))
        .returning();

      return updated;
    });
  },
};

export const medicationChangeQueries = {
  async forPatient(patientId: string): Promise<MedicationChange[]> {
    return db
      .select()
      .from(medicationChanges)
      .where(
        inArray(
          medicationChanges.medicationId,
          db
            .select({ id: medications.id })
            .from(medications)
            .where(eq(medications.patientId, patientId)),
        ),
      )
      .orderBy(desc(medicationChanges.changedAt));
  },

  // Patient-scoped via the inner-select on patient's medications — a medId
  // belonging to another patient returns [] rather than leaking rows.
  async forMedication(
    patientId: string,
    medicationId: string,
  ): Promise<MedicationChange[]> {
    return db
      .select()
      .from(medicationChanges)
      .where(
        and(
          eq(medicationChanges.medicationId, medicationId),
          inArray(
            medicationChanges.medicationId,
            db
              .select({ id: medications.id })
              .from(medications)
              .where(eq(medications.patientId, patientId)),
          ),
        ),
      )
      .orderBy(desc(medicationChanges.changedAt));
  },
};
