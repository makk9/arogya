// Smoke test for POST /api/medications/[id]/changes.
// Run with: npx tsx --conditions react-server --env-file=.env.local scripts/smoke-medication-changes.ts
//
// Probes happy path for each field type + 3 error paths against the running
// dev server. Picks a real medication ID from the DB so we don't have to
// guess.

import { db } from "@/db";
import {
  doctors,
  medicationChanges,
  medications,
  visits,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { STUB_PATIENT_ID } from "@/lib/auth";

const BASE = "http://localhost:3000";

async function POST(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

async function main() {
  const meds = await db
    .select()
    .from(medications)
    .where(eq(medications.patientId, STUB_PATIENT_ID))
    .limit(5);
  if (meds.length === 0) {
    console.error("No medications seeded for stub patient. Seed first.");
    process.exit(1);
  }
  const active = meds.find((m) => m.status === "active") ?? meds[0];
  console.log("Using medication:", active.id, active.name, active.status);

  const allDoctors = await db
    .select()
    .from(doctors)
    .where(eq(doctors.patientId, STUB_PATIENT_ID))
    .limit(5);
  const otherDoctor = allDoctors.find((d) => d.id !== active.prescribingDoctor);
  console.log("Available doctors:", allDoctors.map((d) => d.name).join(", "));

  const allVisits = await db
    .select()
    .from(visits)
    .where(eq(visits.patientId, STUB_PATIENT_ID))
    .limit(3);
  console.log("Available visits:", allVisits.length);

  // 1. Happy: field=dose
  console.log("\n1. POST field=dose newValue='9.99mg-test'");
  const r1 = await POST(`/api/medications/${active.id}/changes`, {
    field: "dose",
    newValue: "9.99mg-test",
    reason: "smoke test",
  });
  console.log("  ", r1.status, JSON.stringify(r1.body).slice(0, 200));

  // 2. Happy: field=frequency
  console.log("\n2. POST field=frequency newValue='twice daily test'");
  const r2 = await POST(`/api/medications/${active.id}/changes`, {
    field: "frequency",
    newValue: "twice daily test",
  });
  console.log("  ", r2.status, JSON.stringify(r2.body).slice(0, 200));

  // 3. Bad: missing field
  console.log("\n3. POST missing field (expect 400)");
  const r3 = await POST(`/api/medications/${active.id}/changes`, {
    newValue: "x",
  });
  console.log("  ", r3.status, JSON.stringify(r3.body).slice(0, 200));

  // 4. Bad: status with non-paused newValue
  console.log("\n4. POST field=status newValue='active' (expect 400 schema)");
  const r4 = await POST(`/api/medications/${active.id}/changes`, {
    field: "status",
    newValue: "active",
  });
  console.log("  ", r4.status, JSON.stringify(r4.body).slice(0, 200));

  // 5. Bad: not_found (random uuid)
  console.log("\n5. POST against random uuid (expect 404)");
  const r5 = await POST(
    `/api/medications/11111111-1111-1111-1111-111111111111/changes`,
    { field: "dose", newValue: "9mg" },
  );
  console.log("  ", r5.status, JSON.stringify(r5.body).slice(0, 200));

  // 6. Bad: prescribing_doctor with same doctor (no-op)
  if (active.prescribingDoctor) {
    console.log("\n6. POST field=prescribing_doctor same doctor (expect 400)");
    const r6 = await POST(`/api/medications/${active.id}/changes`, {
      field: "prescribing_doctor",
      newValue: active.prescribingDoctor,
    });
    console.log("  ", r6.status, JSON.stringify(r6.body).slice(0, 200));
  }

  // 7. Happy: prescribing_doctor with a different one
  if (otherDoctor) {
    console.log("\n7. POST field=prescribing_doctor different doctor");
    const r7 = await POST(`/api/medications/${active.id}/changes`, {
      field: "prescribing_doctor",
      newValue: otherDoctor.id,
    });
    console.log("  ", r7.status, JSON.stringify(r7.body).slice(0, 200));
  }

  // 8. Happy: field=status newValue=paused (must come after we've confirmed
  // active above; we re-check the current state since previous changes may
  // have shifted it).
  const [reread] = await db
    .select()
    .from(medications)
    .where(eq(medications.id, active.id))
    .limit(1);
  if (reread.status === "active") {
    console.log("\n8. POST field=status newValue=paused");
    const r8 = await POST(`/api/medications/${active.id}/changes`, {
      field: "status",
      newValue: "paused",
    });
    console.log("  ", r8.status, JSON.stringify(r8.body).slice(0, 200));

    // 9. Bad: status change on already-paused med
    console.log("\n9. POST field=status again on now-paused (expect 409)");
    const r9 = await POST(`/api/medications/${active.id}/changes`, {
      field: "status",
      newValue: "paused",
    });
    console.log("  ", r9.status, JSON.stringify(r9.body).slice(0, 200));
  } else {
    console.log("\n8-9. Skipping status tests; med no longer active");
  }

  // Tally the change-log rows we wrote.
  const writtenRows = await db
    .select()
    .from(medicationChanges)
    .where(eq(medicationChanges.medicationId, active.id));
  console.log(
    `\nTotal change rows for this medication after smoke: ${writtenRows.length}`,
  );

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
