import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  conditionChanges,
  conditionChangeField,
  conditions,
  conditionSeverity,
  conditionStatus,
  type Condition,
  type ConditionChange,
  type NewCondition,
} from "@/db/schema";
import { slugify } from "@/lib/agents/_shared/serializers/format";
import { doctorInScope } from "./_shared";

type ConditionStatus = (typeof conditionStatus.enumValues)[number];
type ConditionSeverity = (typeof conditionSeverity.enumValues)[number];
// The DB enum permits "notes" as a change field, but per the approved plan notes
// is edited inline via PATCH (not change-logged) — §6.5 lists only status /
// severity / managing-doctor in Condition History. The loggable subset excludes
// it so the change-create switch stays exhaustive over the three real cases.
type LoggableConditionField = Exclude<
  (typeof conditionChangeField.enumValues)[number],
  "notes"
>;

// Non-clinical fields editable via PATCH. The three change-logged fields
// (status / severity / managing_doctor) are excluded — they route through
// conditionChangeQueries.create. notes IS here (inline-edited, not logged).
type ConditionUpdate = Partial<
  Pick<
    NewCondition,
    "name" | "category" | "icdCode" | "diagnosedOn" | "diagnosedBy" | "notes"
  >
>;

// Domain error kinds (Medication's discontinued-specific kinds are dropped —
// Condition has no terminal state-block; a resolved condition may recur):
//  - not_found             — patient-scoped lookup missed
//  - status_unchanged      — field=status no-op (newValue === current.status).
//                            Named for what it is: Condition permits all real
//                            transitions, so the only status rejection is a no-op
//                            (not a transition-rule violation as in Medication).
//  - linked_entity_invalid — a referenced FK target (doctor at create, or
//                            managing_doctor on change) is out of patient scope
//                            (reason "doctor_not_found") or duplicates the
//                            current managing doctor (reason "no_op")
export class ConditionDomainError extends Error {
  constructor(
    public readonly kind:
      | "not_found"
      | "status_unchanged"
      | "linked_entity_invalid",
    public readonly meta?: {
      currentStatus?: ConditionStatus;
      field?: string;
      reason?: string;
    },
  ) {
    super(kind);
    this.name = "ConditionDomainError";
  }
}

export const conditionQueries = {
  async forPatient(patientId: string): Promise<Condition[]> {
    return db
      .select()
      .from(conditions)
      .where(eq(conditions.patientId, patientId))
      .orderBy(desc(conditions.createdAt));
  },

  async byStatus(
    patientId: string,
    status: ConditionStatus,
  ): Promise<Condition[]> {
    return db
      .select()
      .from(conditions)
      .where(
        and(eq(conditions.patientId, patientId), eq(conditions.status, status)),
      )
      .orderBy(desc(conditions.createdAt));
  },

  // Convenience alias used by serializers. Kept on top of byStatus so renaming
  // call sites is unnecessary.
  async active(patientId: string): Promise<Condition[]> {
    return conditionQueries.byStatus(patientId, "active");
  },

  async getById(patientId: string, id: string): Promise<Condition | null> {
    const rows = await db
      .select()
      .from(conditions)
      .where(and(eq(conditions.id, id), eq(conditions.patientId, patientId)))
      .limit(1);
    return rows[0] ?? null;
  },

  // Resolves a citation-pill slug (the `slugify(name)` half of `condition:<slug>`)
  // back to a condition, for the chat citation-pill popover. Reuses the same
  // `slugify()` the serializer used to emit the slug, so it round-trips by
  // construction. Known limitation (mirrors medicationQueries.bySlug): the
  // cross-vault `-2`/`-3` collision suffixes from vault-context.ts are NOT
  // reproduced here — a suffixed citation resolves to null. Acceptable for
  // single-patient v1 (names unique in practice); faithful disambiguation is v1.5.
  async bySlug(patientId: string, slug: string): Promise<Condition | null> {
    const rows = await conditionQueries.forPatient(patientId);
    return rows.find((c) => slugify(c.name) === slug) ?? null;
  },

  // Validates FK targets are in patient scope before insert (so a bad/foreign
  // doctor id returns a mapped 400, not a Postgres FK-violation 500, and can't
  // reference another patient's doctor). /changes enforces the same for managing
  // doctor; create owns diagnosedBy + managingDoctor.
  async create(values: NewCondition): Promise<Condition> {
    if (
      values.diagnosedBy &&
      !(await doctorInScope(values.patientId, values.diagnosedBy))
    ) {
      throw new ConditionDomainError("linked_entity_invalid", {
        field: "diagnosedBy",
        reason: "doctor_not_found",
      });
    }
    if (
      values.managingDoctor &&
      !(await doctorInScope(values.patientId, values.managingDoctor))
    ) {
      throw new ConditionDomainError("linked_entity_invalid", {
        field: "managingDoctor",
        reason: "doctor_not_found",
      });
    }
    const [row] = await db.insert(conditions).values(values).returning();
    return row;
  },

  async update(
    patientId: string,
    id: string,
    values: ConditionUpdate,
  ): Promise<Condition | null> {
    const [row] = await db
      .update(conditions)
      .set(values)
      .where(and(eq(conditions.id, id), eq(conditions.patientId, patientId)))
      .returning();
    return row ?? null;
  },

  async delete(patientId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(conditions)
      .where(and(eq(conditions.id, id), eq(conditions.patientId, patientId)))
      .returning({ id: conditions.id });
    return result.length > 0;
  },
};

export const conditionChangeQueries = {
  // Sort by changedAt (the clinical day the change happened) with createdAt as a
  // tiebreaker — same rationale as medicationChangeQueries: date-only input
  // coerces to noon UTC, so same-day rows tie on changedAt and createdAt breaks
  // the tie in write order.
  async forPatient(patientId: string): Promise<ConditionChange[]> {
    return db
      .select()
      .from(conditionChanges)
      .where(
        inArray(
          conditionChanges.conditionId,
          db
            .select({ id: conditions.id })
            .from(conditions)
            .where(eq(conditions.patientId, patientId)),
        ),
      )
      .orderBy(
        desc(conditionChanges.changedAt),
        desc(conditionChanges.createdAt),
      );
  },

  // Patient-scoped via the inner-select on the patient's conditions — a
  // conditionId belonging to another patient returns [] rather than leaking rows.
  async forCondition(
    patientId: string,
    conditionId: string,
  ): Promise<ConditionChange[]> {
    return db
      .select()
      .from(conditionChanges)
      .where(
        and(
          eq(conditionChanges.conditionId, conditionId),
          inArray(
            conditionChanges.conditionId,
            db
              .select({ id: conditions.id })
              .from(conditions)
              .where(eq(conditions.patientId, patientId)),
          ),
        ),
      )
      .orderBy(
        desc(conditionChanges.changedAt),
        desc(conditionChanges.createdAt),
      );
  },

  // Transactional: read current → validate transitions / linked entities →
  // insert change-log row → update the parent's field. Mirrors
  // medicationChangeQueries.create. `oldValue` is server-computed from the
  // current row — never trusted from the client.
  //
  // No discontinued-style blanket block: a resolved condition can recur, so
  // resolved → active is permitted. Only no-op status changes are rejected.
  async create(
    patientId: string,
    conditionId: string,
    input: {
      field: LoggableConditionField;
      newValue: string;
      reason?: string;
      changedAt?: Date;
      recordedBy: string;
    },
  ): Promise<{ change: ConditionChange; condition: Condition }> {
    return db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(conditions)
        .where(
          and(
            eq(conditions.id, conditionId),
            eq(conditions.patientId, patientId),
          ),
        )
        .limit(1);

      if (!current) {
        throw new ConditionDomainError("not_found");
      }

      // Field-specific guards. Status no-ops are rejected; severity no-ops are
      // intentionally permitted — re-logging the same severity is harmless and
      // matches Medication, which guards status but not its free-value fields.
      if (input.field === "status") {
        if (input.newValue === current.status) {
          throw new ConditionDomainError("status_unchanged", {
            currentStatus: current.status,
          });
        }
      }

      if (input.field === "managing_doctor") {
        if (current.managingDoctor === input.newValue) {
          throw new ConditionDomainError("linked_entity_invalid", {
            field: "newValue",
            reason: "no_op",
          });
        }
        if (!(await doctorInScope(patientId, input.newValue))) {
          throw new ConditionDomainError("linked_entity_invalid", {
            field: "newValue",
            reason: "doctor_not_found",
          });
        }
      }

      const oldValue: string | null = (() => {
        switch (input.field) {
          case "status":
            return current.status;
          case "severity":
            return current.severity;
          case "managing_doctor":
            return current.managingDoctor;
        }
      })();

      const [change] = await tx
        .insert(conditionChanges)
        .values({
          conditionId,
          field: input.field,
          oldValue,
          newValue: input.newValue,
          reason: input.reason ?? null,
          recordedBy: input.recordedBy,
          ...(input.changedAt ? { changedAt: input.changedAt } : {}),
        })
        .returning();

      const patch: Partial<NewCondition> = (() => {
        switch (input.field) {
          case "status":
            return { status: input.newValue as ConditionStatus };
          case "severity":
            return { severity: input.newValue as ConditionSeverity };
          case "managing_doctor":
            return { managingDoctor: input.newValue };
        }
      })();

      const [updated] = await tx
        .update(conditions)
        .set(patch)
        .where(eq(conditions.id, conditionId))
        .returning();

      return { change, condition: updated };
    });
  },
};
