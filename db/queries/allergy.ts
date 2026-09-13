import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  allergies,
  allergyChanges,
  allergySeverity,
  allergyStatus,
  type Allergy,
  type AllergyChange,
  type NewAllergy,
} from "@/db/schema";
import { slugify } from "@/lib/agents/_shared/serializers/format";
import { doctorInScope } from "./_shared";

type AllergyStatus = (typeof allergyStatus.enumValues)[number];
type AllergySeverity = (typeof allergySeverity.enumValues)[number];

// The §6.5 Allergy History axes are status + severity — the only change-logged
// fields. allergy_changes.field is a plain text column (no pgEnum, unlike
// condition_changes), so this union is the sole guard on what gets written.
type LoggableAllergyField = "status" | "severity";

// Non-clinical fields editable via PATCH. status / severity are excluded — they
// route through allergyChangeQueries.create. category stays here (it scopes AI
// risk reasoning but isn't a change-log axis per §6.5:1402, same treatment as
// Condition's category).
type AllergyUpdate = Partial<
  Pick<
    NewAllergy,
    "substance" | "category" | "reaction" | "firstNoted" | "confirmedBy" | "notes"
  >
>;

// Domain error kinds (mirrors ConditionDomainError — Allergy has no terminal
// state either; a resolved allergy can recur and a disproved one can be
// re-suspected):
//  - not_found             — patient-scoped lookup missed
//  - status_unchanged      — field=status no-op (newValue === current.status)
//  - linked_entity_invalid — confirmedBy doctor out of patient scope
//                            (reason "doctor_not_found")
export class AllergyDomainError extends Error {
  constructor(
    public readonly kind:
      | "not_found"
      | "status_unchanged"
      | "linked_entity_invalid",
    public readonly meta?: {
      currentStatus?: AllergyStatus;
      field?: string;
      reason?: string;
    },
  ) {
    super(kind);
    this.name = "AllergyDomainError";
  }
}

export const allergyQueries = {
  async forPatient(patientId: string): Promise<Allergy[]> {
    return db
      .select()
      .from(allergies)
      .where(eq(allergies.patientId, patientId))
      .orderBy(desc(allergies.createdAt));
  },

  async byStatus(
    patientId: string,
    status: AllergyStatus,
  ): Promise<Allergy[]> {
    return db
      .select()
      .from(allergies)
      .where(
        and(eq(allergies.patientId, patientId), eq(allergies.status, status)),
      )
      .orderBy(desc(allergies.createdAt));
  },

  async getById(patientId: string, id: string): Promise<Allergy | null> {
    const rows = await db
      .select()
      .from(allergies)
      .where(and(eq(allergies.id, id), eq(allergies.patientId, patientId)))
      .limit(1);
    return rows[0] ?? null;
  },

  // Resolves a citation-pill slug (the `slugify(substance)` half of
  // `allergy:<slug>`) back to an allergy, for the chat citation-pill popover.
  // Same construction-round-trip + collision-suffix limitation as
  // medicationQueries.bySlug / conditionQueries.bySlug.
  async bySlug(patientId: string, slug: string): Promise<Allergy | null> {
    const rows = await allergyQueries.forPatient(patientId);
    return rows.find((a) => slugify(a.substance) === slug) ?? null;
  },

  // Validates the confirmedBy FK target is in patient scope before insert (so a
  // bad/foreign doctor id returns a mapped 400, not a Postgres FK-violation 500,
  // and can't reference another patient's doctor).
  async create(values: NewAllergy): Promise<Allergy> {
    if (
      values.confirmedBy &&
      !(await doctorInScope(values.patientId, values.confirmedBy))
    ) {
      throw new AllergyDomainError("linked_entity_invalid", {
        field: "confirmedBy",
        reason: "doctor_not_found",
      });
    }
    const [row] = await db.insert(allergies).values(values).returning();
    return row;
  },

  async update(
    patientId: string,
    id: string,
    values: AllergyUpdate,
  ): Promise<Allergy | null> {
    // Same scope-check as create(): a PATCHed confirmedBy must be one of this
    // patient's doctors.
    if (
      values.confirmedBy &&
      !(await doctorInScope(patientId, values.confirmedBy))
    ) {
      throw new AllergyDomainError("linked_entity_invalid", {
        field: "confirmedBy",
        reason: "doctor_not_found",
      });
    }
    const [row] = await db
      .update(allergies)
      .set(values)
      .where(and(eq(allergies.id, id), eq(allergies.patientId, patientId)))
      .returning();
    return row ?? null;
  },

  async delete(patientId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(allergies)
      .where(and(eq(allergies.id, id), eq(allergies.patientId, patientId)))
      .returning({ id: allergies.id });
    return result.length > 0;
  },
};

export const allergyChangeQueries = {
  // Sort by changedAt (the clinical day the change happened) with createdAt as a
  // tiebreaker — date-only input coerces to noon UTC, so same-day rows tie on
  // changedAt and createdAt breaks the tie in write order.
  async forPatient(patientId: string): Promise<AllergyChange[]> {
    return db
      .select()
      .from(allergyChanges)
      .where(
        inArray(
          allergyChanges.allergyId,
          db
            .select({ id: allergies.id })
            .from(allergies)
            .where(eq(allergies.patientId, patientId)),
        ),
      )
      .orderBy(desc(allergyChanges.changedAt), desc(allergyChanges.createdAt));
  },

  // Patient-scoped via the inner-select on the patient's allergies — an
  // allergyId belonging to another patient returns [] rather than leaking rows.
  async forAllergy(
    patientId: string,
    allergyId: string,
  ): Promise<AllergyChange[]> {
    return db
      .select()
      .from(allergyChanges)
      .where(
        and(
          eq(allergyChanges.allergyId, allergyId),
          inArray(
            allergyChanges.allergyId,
            db
              .select({ id: allergies.id })
              .from(allergies)
              .where(eq(allergies.patientId, patientId)),
          ),
        ),
      )
      .orderBy(desc(allergyChanges.changedAt), desc(allergyChanges.createdAt));
  },

  // Transactional: read current → validate → insert change-log row → update the
  // parent's field. Mirrors conditionChangeQueries.create. `oldValue` is
  // server-computed from the current row — never trusted from the client.
  //
  // No terminal-state block: all real status transitions are permitted (a
  // resolved allergy can recur; a disproved one can be re-suspected). Only no-op
  // status changes are rejected; severity no-ops are intentionally permitted,
  // matching Condition.
  async create(
    patientId: string,
    allergyId: string,
    input: {
      field: LoggableAllergyField;
      newValue: string;
      reason?: string;
      changedAt?: Date;
      recordedBy: string;
    },
  ): Promise<{ change: AllergyChange; allergy: Allergy }> {
    return db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(allergies)
        .where(
          and(eq(allergies.id, allergyId), eq(allergies.patientId, patientId)),
        )
        .limit(1)
        .for("update");

      if (!current) {
        throw new AllergyDomainError("not_found");
      }

      if (input.field === "status" && input.newValue === current.status) {
        throw new AllergyDomainError("status_unchanged", {
          currentStatus: current.status,
        });
      }

      const oldValue: string | null =
        input.field === "status" ? current.status : current.severity;

      const [change] = await tx
        .insert(allergyChanges)
        .values({
          allergyId,
          field: input.field,
          oldValue,
          newValue: input.newValue,
          reason: input.reason ?? null,
          recordedBy: input.recordedBy,
          ...(input.changedAt ? { changedAt: input.changedAt } : {}),
        })
        .returning();

      const patch: Partial<NewAllergy> =
        input.field === "status"
          ? { status: input.newValue as AllergyStatus }
          : { severity: input.newValue as AllergySeverity };

      const [updated] = await tx
        .update(allergies)
        .set(patch)
        .where(eq(allergies.id, allergyId))
        .returning();

      return { change, allergy: updated };
    });
  },
};
