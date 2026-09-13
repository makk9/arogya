import { and, asc, desc, eq, inArray, max } from "drizzle-orm";

import { db } from "@/db";
import {
  doctorChanges,
  doctors,
  visits,
  type Doctor,
  type DoctorChange,
  type NewDoctor,
} from "@/db/schema";
import { slugify } from "@/lib/agents/_shared/serializers/format";

// The change-logged subset, per decisions.md 2026-06-09: specialty + clinic are
// the synthesis-relevant transitions ("the cardiologist moved clinics"); the
// doctor_changes.field column is plain text in the DB (Phase 4 leaves it
// unconstrained), so this union is the only place the subset is encoded.
type LoggableDoctorField = "specialty" | "clinic";

// Non-logged fields editable via PATCH. specialty / clinic route through
// doctorChangeQueries.create.
type DoctorUpdate = Partial<
  Pick<NewDoctor, "name" | "phone" | "email" | "address" | "firstVisit" | "notes">
>;

// Domain error kinds:
//  - not_found      — patient-scoped lookup missed
//  - delete_blocked — the doctor has visits on file; visits.doctor_id is
//    onDelete:"restrict" (a visit without its doctor is clinically meaningless),
//    so deletion is refused with the count for the error copy. Every other
//    doctor FK (med.prescribing_doctor, condition.diagnosed_by/managing_doctor,
//    allergy.confirmed_by, lab.ordered_by, report.linked_doctor_id) is
//    onDelete:"set null" and doesn't block.
export class DoctorDomainError extends Error {
  constructor(
    public readonly kind: "not_found" | "delete_blocked",
    public readonly meta?: { visitCount?: number },
  ) {
    super(kind);
    this.name = "DoctorDomainError";
  }
}

export const doctorQueries = {
  // asc(name): the list page groups by specialty and wants names alphabetical
  // within each group.
  async forPatient(patientId: string): Promise<Doctor[]> {
    return db
      .select()
      .from(doctors)
      .where(eq(doctors.patientId, patientId))
      .orderBy(asc(doctors.name));
  },

  async getById(patientId: string, id: string): Promise<Doctor | null> {
    const rows = await db
      .select()
      .from(doctors)
      .where(and(eq(doctors.id, id), eq(doctors.patientId, patientId)))
      .limit(1);
    return rows[0] ?? null;
  },

  // Resolves a citation-pill slug (the `slugify(name)` half of `doctor:<slug>`)
  // back to a doctor, for the chat citation-pill popover. Same round-trip-by-
  // construction and same `-2`-suffix limitation as medication/condition bySlug
  // (suffixed collision citations resolve to null; acceptable for v1).
  async bySlug(patientId: string, slug: string): Promise<Doctor | null> {
    const rows = await doctorQueries.forPatient(patientId);
    return rows.find((d) => slugify(d.name) === slug) ?? null;
  },

  // No cross-entity FK targets to scope-check (unlike Condition's doctors):
  // a doctor only references its patient.
  async create(values: NewDoctor): Promise<Doctor> {
    const [row] = await db.insert(doctors).values(values).returning();
    return row;
  },

  async update(
    patientId: string,
    id: string,
    values: DoctorUpdate,
  ): Promise<Doctor | null> {
    const [row] = await db
      .update(doctors)
      .set(values)
      .where(and(eq(doctors.id, id), eq(doctors.patientId, patientId)))
      .returning();
    return row ?? null;
  },

  // Pre-checks the restrict-FK so the route returns a mapped 409 (not a
  // Postgres FK-violation 500). The constraint remains the backstop against a
  // visit-create racing the check. Patient scope is verified BEFORE the visit
  // check — an out-of-scope id must read as not-found (false → 404), never as
  // delete_blocked, or the 409 leaks another patient's doctor's existence.
  async delete(patientId: string, id: string): Promise<boolean> {
    const inScope = await doctorQueries.getById(patientId, id);
    if (!inScope) return false;
    const linkedVisits = await db
      .select({ id: visits.id })
      .from(visits)
      .where(eq(visits.doctorId, id));
    if (linkedVisits.length > 0) {
      throw new DoctorDomainError("delete_blocked", {
        visitCount: linkedVisits.length,
      });
    }
    const result = await db
      .delete(doctors)
      .where(and(eq(doctors.id, id), eq(doctors.patientId, patientId)))
      .returning({ id: doctors.id });
    return result.length > 0;
  },

  // `last_visit` is derived from the most recent linked Visit, never stored
  // (Phase 4 Doctor note). Returns doctorId → YYYY-MM-DD of the latest visit;
  // doctors with no visits are absent. Empty until the Visit vertical lands —
  // surfaces render "—". Completed visits only: a scheduled follow-up or a
  // cancelled / no-show visit isn't a visit that happened.
  async lastVisitByDoctor(patientId: string): Promise<Map<string, string>> {
    const rows = await db
      .select({ doctorId: visits.doctorId, lastVisit: max(visits.visitDate) })
      .from(visits)
      .where(and(eq(visits.patientId, patientId), eq(visits.status, "completed")))
      .groupBy(visits.doctorId);
    const byDoctor = new Map<string, string>();
    for (const r of rows) {
      if (r.lastVisit) byDoctor.set(r.doctorId, r.lastVisit);
    }
    return byDoctor;
  },
};

export const doctorChangeQueries = {
  // changedAt + createdAt tiebreaker, same rationale as Condition: date-only
  // input coerces to noon UTC, so same-day rows tie on changedAt and createdAt
  // breaks the tie in write order.
  async forPatient(patientId: string): Promise<DoctorChange[]> {
    return db
      .select()
      .from(doctorChanges)
      .where(
        inArray(
          doctorChanges.doctorId,
          db
            .select({ id: doctors.id })
            .from(doctors)
            .where(eq(doctors.patientId, patientId)),
        ),
      )
      .orderBy(desc(doctorChanges.changedAt), desc(doctorChanges.createdAt));
  },

  // Patient-scoped via the inner-select on the patient's doctors — a doctorId
  // belonging to another patient returns [] rather than leaking rows.
  async forDoctor(patientId: string, doctorId: string): Promise<DoctorChange[]> {
    return db
      .select()
      .from(doctorChanges)
      .where(
        and(
          eq(doctorChanges.doctorId, doctorId),
          inArray(
            doctorChanges.doctorId,
            db
              .select({ id: doctors.id })
              .from(doctors)
              .where(eq(doctors.patientId, patientId)),
          ),
        ),
      )
      .orderBy(desc(doctorChanges.changedAt), desc(doctorChanges.createdAt));
  },

  // Transactional: read current → insert change-log row → update the parent's
  // field. `oldValue` is server-computed from the current row — never trusted
  // from the client. No transition guards: Doctor has no status machine, and
  // re-logging the same free-text value is harmless (matches Medication's
  // treatment of dose/frequency).
  async create(
    patientId: string,
    doctorId: string,
    input: {
      field: LoggableDoctorField;
      newValue: string;
      reason?: string;
      changedAt?: Date;
      recordedBy: string;
    },
  ): Promise<{ change: DoctorChange; doctor: Doctor }> {
    return db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(doctors)
        .where(and(eq(doctors.id, doctorId), eq(doctors.patientId, patientId)))
        .limit(1)
        .for("update");

      if (!current) {
        throw new DoctorDomainError("not_found");
      }

      const oldValue: string | null =
        input.field === "specialty" ? current.specialty : current.clinic;

      const [change] = await tx
        .insert(doctorChanges)
        .values({
          doctorId,
          field: input.field,
          oldValue,
          newValue: input.newValue,
          reason: input.reason ?? null,
          recordedBy: input.recordedBy,
          ...(input.changedAt ? { changedAt: input.changedAt } : {}),
        })
        .returning();

      const patch: Partial<NewDoctor> =
        input.field === "specialty"
          ? { specialty: input.newValue }
          : { clinic: input.newValue };

      const [updated] = await tx
        .update(doctors)
        .set(patch)
        .where(eq(doctors.id, doctorId))
        .returning();

      return { change, doctor: updated };
    });
  },
};
