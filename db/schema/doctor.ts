import { relations } from "drizzle-orm";
import { date, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { patients } from "./patient";
import { visits } from "./visit";

export const doctors = pgTable("doctors", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  specialty: text("specialty").notNull(),
  clinic: text("clinic"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  firstVisit: date("first_visit"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const doctorChanges = pgTable(
  "doctor_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    changedAt: timestamp("changed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    field: text("field").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    reason: text("reason"),
    recordedBy: uuid("recorded_by"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    doctorIdx: index("doctor_changes_doctor_idx").on(table.doctorId),
  }),
);

export const doctorsRelations = relations(doctors, ({ one, many }) => ({
  patient: one(patients, {
    fields: [doctors.patientId],
    references: [patients.id],
  }),
  visits: many(visits),
  changes: many(doctorChanges),
}));

export const doctorChangesRelations = relations(doctorChanges, ({ one }) => ({
  doctor: one(doctors, {
    fields: [doctorChanges.doctorId],
    references: [doctors.id],
  }),
}));

export type Doctor = typeof doctors.$inferSelect;
export type NewDoctor = typeof doctors.$inferInsert;
export type DoctorChange = typeof doctorChanges.$inferSelect;
export type NewDoctorChange = typeof doctorChanges.$inferInsert;
