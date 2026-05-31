import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  doctors,
  medicationChanges,
  medicationChangeField,
  medications,
  medicationStatus,
  visits,
  type Medication,
  type MedicationChange,
  type NewMedication,
} from "@/db/schema";
import { todayInTimezone } from "@/lib/datetime";
import { slugify } from "@/lib/agents/_shared/serializers/format";

type MedicationStatus = (typeof medicationStatus.enumValues)[number];
type MedicationChangeField = (typeof medicationChangeField.enumValues)[number];

type MedicationUpdate = Partial<
  Pick<
    NewMedication,
    "name" | "brandName" | "form" | "purpose" | "category" | "startedOn" | "notes"
  >
>;

// Domain error kinds:
//  - not_found            — patient-scoped lookup missed
//  - already_discontinued — discontinue endpoint hit a med already in that state
//  - medication_discontinued — changes endpoint refuses log entries on a
//                              discontinued med (distinct from above so the
//                              route can render a different message)
//  - invalid_status_transition — field=status with current!=active or newValue
//                                outside the v1-permitted transition
//  - linked_entity_invalid — newValue or linkedVisitId references a record
//                            outside patient scope, or duplicates the current
//                            prescriber (no-op guard)
export class MedicationDomainError extends Error {
  constructor(
    public readonly kind:
      | "not_found"
      | "already_discontinued"
      | "medication_discontinued"
      | "invalid_status_transition"
      | "linked_entity_invalid",
    public readonly meta?: {
      currentStatus?: MedicationStatus;
      discontinuedOn?: string | null;
      field?: string;
      reason?: string;
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

  // Resolves a citation-pill slug (the `slugify(name)` half of `med:<slug>`)
  // back to a medication. Powers the chat citation-pill popover (Phase C item 7):
  // pills carry `slugify(name)`, not the UUID, so this is the slug→entity bridge.
  //
  // Match logic reuses the same `slugify()` the serializer used to emit the slug,
  // so it round-trips by construction. Known limitation: the cross-vault `-2`/`-3`
  // collision suffixes assigned in vault-context.ts are NOT reproduced here. A
  // base slug resolves to the FIRST matching med; a suffixed citation (e.g.
  // `med:amlodipine-2`) matches no name and returns null — so the popover shows
  // "not in the record" even though the med exists. Acceptable for single-patient
  // v1 (names are unique in practice); faithful disambiguation is a v1.5 item.
  async bySlug(patientId: string, slug: string): Promise<Medication | null> {
    const rows = await medicationQueries.forPatient(patientId);
    return rows.find((m) => slugify(m.name) === slug) ?? null;
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
  // Sort by changedAt (the clinical day the change happened) with createdAt as
  // a tiebreaker. Date-only form input coerces to noon UTC, so multiple rows
  // dated the same day tie on changedAt; createdAt (defaultNow()) captures the
  // real insert instant and breaks the tie in write order.
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
      .orderBy(
        desc(medicationChanges.changedAt),
        desc(medicationChanges.createdAt),
      );
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
      .orderBy(
        desc(medicationChanges.changedAt),
        desc(medicationChanges.createdAt),
      );
  },

  // Transactional: read current med → validate transitions and linked entities
  // → insert change-log row → update parent's current_* field. Mirrors the
  // discontinue helper's shape: throws MedicationDomainError for state-machine
  // violations and lets the route map kinds to HTTP codes.
  //
  // `oldValue` is server-computed from the current med row — never trusted
  // from the client. The status branch sets medications.status="paused" only;
  // discontinued_on stays untouched (that's the discontinue route's job).
  async create(
    patientId: string,
    medicationId: string,
    input: {
      field: MedicationChangeField;
      newValue: string;
      reason?: string;
      changedAt?: Date;
      linkedVisitId?: string;
      recordedBy: string;
    },
  ): Promise<{ change: MedicationChange; medication: Medication }> {
    return db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(medications)
        .where(
          and(eq(medications.id, medicationId), eq(medications.patientId, patientId)),
        )
        .limit(1);

      if (!current) {
        throw new MedicationDomainError("not_found");
      }
      if (current.status === "discontinued") {
        throw new MedicationDomainError("medication_discontinued", {
          currentStatus: current.status,
          discontinuedOn: current.discontinuedOn,
        });
      }

      // Field-specific guards.
      if (input.field === "status") {
        if (current.status !== "active") {
          throw new MedicationDomainError("invalid_status_transition", {
            currentStatus: current.status,
          });
        }
        if (input.newValue !== "paused") {
          // Defensive — the API schema constrains this to "paused"; this guard
          // catches a direct-helper-call bypass.
          throw new MedicationDomainError("invalid_status_transition", {
            currentStatus: current.status,
          });
        }
      }

      if (input.field === "prescribing_doctor") {
        if (current.prescribingDoctor === input.newValue) {
          throw new MedicationDomainError("linked_entity_invalid", {
            field: "newValue",
            reason: "already the prescribing doctor",
          });
        }
        const [doctor] = await tx
          .select({ id: doctors.id })
          .from(doctors)
          .where(
            and(eq(doctors.id, input.newValue), eq(doctors.patientId, patientId)),
          )
          .limit(1);
        if (!doctor) {
          throw new MedicationDomainError("linked_entity_invalid", {
            field: "newValue",
            reason: "doctor not found",
          });
        }
      }

      if (input.linkedVisitId) {
        const [visit] = await tx
          .select({ id: visits.id })
          .from(visits)
          .where(
            and(
              eq(visits.id, input.linkedVisitId),
              eq(visits.patientId, patientId),
            ),
          )
          .limit(1);
        if (!visit) {
          throw new MedicationDomainError("linked_entity_invalid", {
            field: "linkedVisitId",
            reason: "visit not found",
          });
        }
      }

      const oldValue: string | null = (() => {
        switch (input.field) {
          case "dose":
            return current.currentDose;
          case "frequency":
            return current.currentFrequency;
          case "status":
            return current.status;
          case "prescribing_doctor":
            return current.prescribingDoctor;
        }
      })();

      const [change] = await tx
        .insert(medicationChanges)
        .values({
          medicationId,
          field: input.field,
          oldValue,
          newValue: input.newValue,
          reason: input.reason ?? null,
          recordedBy: input.recordedBy,
          linkedVisitId: input.linkedVisitId ?? null,
          ...(input.changedAt ? { changedAt: input.changedAt } : {}),
        })
        .returning();

      const patch: Partial<NewMedication> = (() => {
        switch (input.field) {
          case "dose":
            return { currentDose: input.newValue };
          case "frequency":
            return { currentFrequency: input.newValue };
          case "status":
            return { status: "paused" };
          case "prescribing_doctor":
            return { prescribingDoctor: input.newValue };
        }
      })();

      const [updated] = await tx
        .update(medications)
        .set(patch)
        .where(eq(medications.id, medicationId))
        .returning();

      return { change, medication: updated };
    });
  },
};
