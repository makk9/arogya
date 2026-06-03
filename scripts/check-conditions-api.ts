/**
 * Runtime smoke + assertion check for the Condition API layer (Phase D).
 * Mirrors scripts/smoke-medication-changes.ts in shape (hits the running dev
 * server over HTTP against arogya-dev) but adds hard assertions + a non-zero
 * exit on any failure, like scripts/check-citation-pill-resolve.ts.
 *
 * Self-contained: it seeds its own doctor + conditions (the stub patient has no
 * seeded medical data) and deletes everything it created in a finally block, so
 * arogya-dev is left identity-only whether the run passes or fails.
 *
 * REQUIRES the dev server running:  npm run dev   (separate terminal)
 * Run via:  npm run conditions-api:check
 */

import { eq, inArray, like } from "drizzle-orm";

import { db } from "@/db";
import { conditions, doctors } from "@/db/schema";
import { STUB_PATIENT_ID, STUB_USER_ID } from "@/lib/auth";
import { slugify } from "@/lib/agents/_shared/serializers/format";

const BASE = "http://localhost:3000";

type Res = { status: number; body: unknown };

async function request(
  method: string,
  path: string,
  body?: unknown,
): Promise<Res> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown = text;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: res.status, body: parsed };
}

// Narrowing helpers — the project bans `any`, so navigate response bodies as
// nested Record<string, unknown>.
function rec(x: unknown): Record<string, unknown> {
  return x && typeof x === "object" ? (x as Record<string, unknown>) : {};
}
function str(x: unknown): string | undefined {
  return typeof x === "string" ? x : undefined;
}

let passes = 0;
let failures = 0;

function expect(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    passes += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// Does an error body carry the given field in details.fieldErrors[field], with
// the message containing `needle`?
function fieldErrorIncludes(
  body: unknown,
  field: string,
  needle: string,
): boolean {
  const fieldErrors = rec(rec(rec(body).error).details).fieldErrors;
  const arr = rec(fieldErrors)[field];
  return Array.isArray(arr) && arr.some((m) => str(m)?.includes(needle));
}

async function main(): Promise<void> {
  // Preflight: is the dev server up?
  try {
    await fetch(`${BASE}/api/conditions`);
  } catch {
    console.error(
      "Dev server not reachable at " +
        BASE +
        " — start it with `npm run dev` first.",
    );
    process.exit(1);
  }

  const createdConditionIds: string[] = [];
  let seededDoctorId: string | null = null;

  try {
    // Pre-sweep: cleanup is id-tracked in finally, so a SIGKILL mid-run could
    // orphan "ZZZ-smoke" rows. Clear any leftovers up front so a prior crash
    // self-heals on the next run.
    await db.delete(conditions).where(like(conditions.name, "ZZZ-smoke%"));
    await db.delete(doctors).where(like(doctors.name, "ZZZ-smoke%"));

    // Seed a doctor (managing_doctor change needs one in patient scope; the
    // Doctor entity isn't built yet).
    const [doc] = await db
      .insert(doctors)
      .values({
        patientId: STUB_PATIENT_ID,
        name: "ZZZ-smoke Dr. Sharma",
        specialty: "Cardiology",
      })
      .returning({ id: doctors.id });
    seededDoctorId = doc.id;

    // --- Create ---------------------------------------------------------
    console.log("\nPOST /api/conditions");
    const cName = "ZZZ-smoke Hypertension";
    const cSlug = slugify(cName);
    const rA = await request("POST", "/api/conditions", { name: cName });
    const condA = rec(rec(rA.body).condition);
    const idA = str(condA.id);
    if (idA) createdConditionIds.push(idA);
    expect("name-only → 201", rA.status === 201, `got ${rA.status}`);
    expect(
      "name-only defaults status=active",
      condA.status === "active",
      `got ${str(condA.status)}`,
    );
    expect("name-only severity=null", condA.severity === null);

    const rB = await request("POST", "/api/conditions", {
      name: "ZZZ-smoke Diabetes",
      status: "controlled",
      category: "endocrine",
      severity: "moderate",
      diagnosedOn: "2020-03-15",
      notes: "diet-managed",
    });
    const condB = rec(rec(rB.body).condition);
    const idB = str(condB.id);
    if (idB) createdConditionIds.push(idB);
    expect("full body → 201", rB.status === 201, `got ${rB.status}`);
    expect(
      "full body persists status/severity/notes",
      condB.status === "controlled" &&
        condB.severity === "moderate" &&
        condB.notes === "diet-managed",
    );

    // create scope-check (the #4 guard rail): an out-of-scope FK target is
    // rejected with a mapped 400, not a Postgres FK-violation 500.
    const rBadDoc = await request("POST", "/api/conditions", {
      name: "ZZZ-smoke ShouldNotPersist",
      managingDoctor: "00000000-0000-0000-0000-000000000000",
    });
    expect(
      "create bogus managingDoctor → 400 doctor_not_found",
      rBadDoc.status === 400 &&
        fieldErrorIncludes(rBadDoc.body, "managingDoctor", "Doctor not found"),
      `got ${rBadDoc.status}`,
    );
    const rGoodDoc = await request("POST", "/api/conditions", {
      name: "ZZZ-smoke WithDoctor",
      managingDoctor: seededDoctorId,
    });
    const condG = rec(rec(rGoodDoc.body).condition);
    const idG = str(condG.id);
    if (idG) createdConditionIds.push(idG);
    expect(
      "create in-scope managingDoctor → 201",
      rGoodDoc.status === 201 && condG.managingDoctor === seededDoctorId,
      `got ${rGoodDoc.status}`,
    );

    // --- List + filter --------------------------------------------------
    console.log("\nGET /api/conditions (+ filters)");
    const rList = await request("GET", "/api/conditions");
    const list = rec(rList.body).conditions;
    expect(
      "list → 200 includes both created",
      rList.status === 200 &&
        Array.isArray(list) &&
        [idA, idB].every((id) =>
          (list as unknown[]).some((c) => str(rec(c).id) === id),
        ),
    );
    const rCtrl = await request("GET", "/api/conditions?status=controlled");
    const ctrl = rec(rCtrl.body).conditions;
    expect(
      "?status=controlled → only controlled",
      rCtrl.status === 200 &&
        Array.isArray(ctrl) &&
        (ctrl as unknown[]).every((c) => rec(c).status === "controlled"),
    );
    const rBogus = await request("GET", "/api/conditions?status=bogus");
    expect("?status=bogus → 400", rBogus.status === 400, `got ${rBogus.status}`);

    // --- Get by id ------------------------------------------------------
    console.log("\nGET /api/conditions/[id]");
    const rGet = await request("GET", `/api/conditions/${idA}`);
    expect("get hit → 200", rGet.status === 200, `got ${rGet.status}`);
    const rGet404 = await request(
      "GET",
      "/api/conditions/00000000-0000-0000-0000-000000000000",
    );
    expect("get random uuid → 404", rGet404.status === 404, `got ${rGet404.status}`);

    // --- PATCH ----------------------------------------------------------
    console.log("\nPATCH /api/conditions/[id]");
    const rPatch = await request("PATCH", `/api/conditions/${idA}`, {
      notes: "BP 150/95 at last reading",
      icdCode: "I10",
    });
    const patched = rec(rec(rPatch.body).condition);
    expect(
      "notes+icdCode inline → 200 & applied",
      rPatch.status === 200 &&
        patched.notes === "BP 150/95 at last reading" &&
        patched.icdCode === "I10",
      `got ${rPatch.status}`,
    );
    const rPatchClinical = await request("PATCH", `/api/conditions/${idA}`, {
      status: "controlled",
    });
    const rejected = rec(rec(rec(rPatchClinical.body).error).details).rejectedFields;
    expect(
      "clinical field status → 400 rejectedFields",
      rPatchClinical.status === 400 && "status" in rec(rejected),
      `got ${rPatchClinical.status}`,
    );
    const rPatchEmpty = await request("PATCH", `/api/conditions/${idA}`, {});
    expect("empty body → 400", rPatchEmpty.status === 400, `got ${rPatchEmpty.status}`);

    // --- Change log -----------------------------------------------------
    console.log("\nPOST /api/conditions/[id]/changes");
    const rStatus = await request("POST", `/api/conditions/${idA}/changes`, {
      field: "status",
      newValue: "controlled",
      reason: "BP normalized on amlodipine",
      changedAt: "2026-04-03",
    });
    const sChange = rec(rec(rStatus.body).change);
    const sCond = rec(rec(rStatus.body).condition);
    expect(
      "status active→controlled → 200, parent updated, oldValue computed",
      rStatus.status === 200 &&
        sCond.status === "controlled" &&
        sChange.oldValue === "active" &&
        sChange.newValue === "controlled",
      `got ${rStatus.status}`,
    );
    expect(
      "changedAt coerced to noon UTC",
      str(sChange.changedAt)?.startsWith("2026-04-03T12:00:00") === true,
      `got ${str(sChange.changedAt)}`,
    );
    const rNoop = await request("POST", `/api/conditions/${idA}/changes`, {
      field: "status",
      newValue: "controlled",
    });
    expect(
      "status no-op → 409",
      rNoop.status === 409 &&
        str(rec(rec(rNoop.body).error).code) === "invalid_state_transition",
      `got ${rNoop.status}`,
    );
    const rSev = await request("POST", `/api/conditions/${idA}/changes`, {
      field: "severity",
      newValue: "severe",
      reason: "escalated",
    });
    expect(
      "severity → 200, parent updated",
      rSev.status === 200 && rec(rec(rSev.body).condition).severity === "severe",
      `got ${rSev.status}`,
    );
    const rDocOk = await request("POST", `/api/conditions/${idA}/changes`, {
      field: "managing_doctor",
      newValue: seededDoctorId,
      reason: "referred to cardiology",
    });
    expect(
      "managing_doctor happy → 200, parent set",
      rDocOk.status === 200 &&
        rec(rec(rDocOk.body).condition).managingDoctor === seededDoctorId,
      `got ${rDocOk.status}`,
    );
    const rDocMiss = await request("POST", `/api/conditions/${idA}/changes`, {
      field: "managing_doctor",
      newValue: "00000000-0000-0000-0000-000000000000",
    });
    expect(
      "managing_doctor bogus → 400 doctor_not_found message",
      rDocMiss.status === 400 &&
        fieldErrorIncludes(rDocMiss.body, "newValue", "Doctor not found"),
      `got ${rDocMiss.status}`,
    );
    const rDocNoop = await request("POST", `/api/conditions/${idA}/changes`, {
      field: "managing_doctor",
      newValue: seededDoctorId,
    });
    expect(
      "managing_doctor no-op → 400 'already the managing doctor'",
      rDocNoop.status === 400 &&
        fieldErrorIncludes(rDocNoop.body, "newValue", "already the managing doctor"),
      `got ${rDocNoop.status}`,
    );
    const rNotesField = await request("POST", `/api/conditions/${idA}/changes`, {
      field: "notes",
      newValue: "x",
    });
    expect(
      "field=notes → 400 (not a change field)",
      rNotesField.status === 400,
      `got ${rNotesField.status}`,
    );

    // --- by-slug --------------------------------------------------------
    console.log("\nGET /api/conditions/by-slug/[slug]");
    const rSlug = await request("GET", `/api/conditions/by-slug/${cSlug}`);
    const preview = rec(rec(rSlug.body).condition);
    expect(
      "by-slug hit → 200 preview shape",
      rSlug.status === 200 &&
        preview.id === idA &&
        "status" in preview &&
        "severity" in preview &&
        "category" in preview &&
        preview.patientId === STUB_PATIENT_ID,
      `got ${rSlug.status}`,
    );
    const rSlugMiss = await request(
      "GET",
      "/api/conditions/by-slug/nonexistent-condition",
    );
    expect("by-slug miss → 404", rSlugMiss.status === 404, `got ${rSlugMiss.status}`);
    const rSlugBad = await request("GET", "/api/conditions/by-slug/Bad_Slug");
    expect("by-slug invalid → 400", rSlugBad.status === 400, `got ${rSlugBad.status}`);

    // --- Delete ---------------------------------------------------------
    console.log("\nDELETE /api/conditions/[id]");
    const rDel = await request("DELETE", `/api/conditions/${idB}`);
    expect("delete → 204", rDel.status === 204, `got ${rDel.status}`);
    if (rDel.status === 204 && idB) {
      // No longer needs cleanup.
      const i = createdConditionIds.indexOf(idB);
      if (i >= 0) createdConditionIds.splice(i, 1);
    }
    const rDelGet = await request("GET", `/api/conditions/${idB}`);
    expect("re-GET deleted → 404", rDelGet.status === 404, `got ${rDelGet.status}`);
    const rDelAgain = await request("DELETE", `/api/conditions/${idB}`);
    expect("delete again → 404", rDelAgain.status === 404, `got ${rDelAgain.status}`);
    const rDelBad = await request("DELETE", "/api/conditions/not-a-uuid");
    expect("delete bad uuid → 400", rDelBad.status === 400, `got ${rDelBad.status}`);

    // Sanity: recordedBy on a change row is the stub user.
    expect(
      "change rows attribute recordedBy = stub user",
      str(sChange.recordedBy) === STUB_USER_ID,
      `got ${str(sChange.recordedBy)}`,
    );
  } finally {
    // Cleanup everything this run created, pass or fail.
    if (createdConditionIds.length > 0) {
      await db
        .delete(conditions)
        .where(inArray(conditions.id, createdConditionIds));
    }
    if (seededDoctorId) {
      await db.delete(doctors).where(eq(doctors.id, seededDoctorId));
    }
  }

  const total = passes + failures;
  if (failures > 0) {
    console.error(`\nconditions-api FAILED: ${failures}/${total} assertion(s)`);
    process.exit(1);
  }
  console.log(`\n✓ All ${total} conditions-api assertions passed.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
