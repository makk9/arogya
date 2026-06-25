import { sql } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import { env } from "@/lib/env";
import { STUB_PATIENT_ID, STUB_USER_ID } from "@/lib/auth";
import {
  doctors,
  insights,
  medicationChanges,
  medications,
  patients,
  symptomEpisodes,
  symptomTypes,
  vitalReadings,
} from "@/db/schema";

/*
 * Seed: demo identity + a small demo vault that backs the Insights surface
 * (§6.8/§6.9) so its citation pills, cited-sources, and linked-context resolve
 * against live rows in Phase D — before onboarding/extraction (Phase E) exist.
 *
 * DEVIATION (signed off 2026-06-23): this expands the canonical seed beyond the
 * Phase-A "identity only, no medical data" rule. The mini-vault is the §1.3
 * demo dataset built early; Phase E's generator writes real insights into the
 * same table and supersedes these. See decisions.md.
 *
 * Stable UUIDs + onConflictDoNothing make re-seeding idempotent. All citation
 * slugs are slugify(name): "Amlodipine" → `amlodipine`, "Dizziness" →
 * `dizziness`, so `§ med: amlodipine` / `§ symptom: dizziness` in the insight
 * bodies resolve to these rows.
 */

const DR_SHARMA = "d0000000-0000-4000-8000-000000000001";
const AMLODIPINE = "a0000000-0000-4000-8000-000000000001";
const AMLO_CHANGE = "c0000000-0000-4000-8000-000000000001";
const DIZZINESS = "50000000-0000-4000-8000-000000000001";
const EP = [
  "e0000000-0000-4000-8000-000000000001",
  "e0000000-0000-4000-8000-000000000002",
  "e0000000-0000-4000-8000-000000000003",
  "e0000000-0000-4000-8000-000000000004",
];
const BP = [
  "b0000000-0000-4000-8000-000000000001",
  "b0000000-0000-4000-8000-000000000002",
  "b0000000-0000-4000-8000-000000000003",
  "b0000000-0000-4000-8000-000000000004",
];
const INS = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
  "10000000-0000-4000-8000-000000000004",
  "10000000-0000-4000-8000-000000000005",
];

const MODEL_VERSION = "seed-phase-d";

async function main() {
  const client = postgres(env.DATABASE_URL, { prepare: false });
  const db = drizzle(client);

  await db
    .insert(patients)
    .values({
      id: STUB_PATIENT_ID,
      ownerUserId: STUB_USER_ID,
      name: "Ramesh Sharma",
      dateOfBirth: "1948-09-15",
      sex: "male",
      country: "India",
      city: "Pune",
      timezone: "Asia/Kolkata",
    })
    .onConflictDoNothing({ target: patients.id });

  // --- Demo vault ----------------------------------------------------------

  await db
    .insert(doctors)
    .values({
      id: DR_SHARMA,
      patientId: STUB_PATIENT_ID,
      name: "Dr. Anjali Sharma",
      specialty: "Cardiology",
      clinic: "Ruby Hall Clinic, Pune",
      firstVisit: "2025-11-10",
    })
    .onConflictDoNothing({ target: doctors.id });

  await db
    .insert(medications)
    .values({
      id: AMLODIPINE,
      patientId: STUB_PATIENT_ID,
      name: "Amlodipine",
      form: "tablet",
      currentDose: "10 mg",
      currentFrequency: "once daily",
      prescribingDoctor: DR_SHARMA,
      category: "allopathic",
      startedOn: "2025-11-10",
      status: "active",
    })
    .onConflictDoNothing({ target: medications.id });

  await db
    .insert(medicationChanges)
    .values({
      id: AMLO_CHANGE,
      medicationId: AMLODIPINE,
      changedAt: new Date("2026-04-03T12:00:00Z"),
      field: "dose",
      oldValue: "5 mg",
      newValue: "10 mg",
      reason: "Morning BP consistently above target",
    })
    .onConflictDoNothing({ target: medicationChanges.id });

  await db
    .insert(symptomTypes)
    .values({
      id: DIZZINESS,
      patientId: STUB_PATIENT_ID,
      name: "Dizziness",
      bodyArea: "head",
      firstNoted: "2026-05-20",
      status: "active",
    })
    .onConflictDoNothing({ target: symptomTypes.id });

  // Four morning episodes clustered over three weeks (the §1.3 demo cluster).
  const episodeRows = [
    { id: EP[0], startedAt: "2026-06-02T08:15:00+05:30", severity: "mild" as const },
    { id: EP[1], startedAt: "2026-06-09T07:50:00+05:30", severity: "moderate" as const },
    { id: EP[2], startedAt: "2026-06-15T08:30:00+05:30", severity: "mild" as const },
    { id: EP[3], startedAt: "2026-06-19T07:40:00+05:30", severity: "moderate" as const },
  ];
  await db
    .insert(symptomEpisodes)
    .values(
      episodeRows.map((e) => ({
        id: e.id,
        symptomTypeId: DIZZINESS,
        patientId: STUB_PATIENT_ID,
        startedAt: new Date(e.startedAt),
        severity: e.severity,
        description: "On standing, shortly after waking.",
        triggers: "Morning, before first dose",
      })),
    )
    .onConflictDoNothing({ target: symptomEpisodes.id });

  // Morning BP readings — three elevated, one normal evening reading.
  const bpRows = [
    { id: BP[0], at: "2026-06-02T08:10:00+05:30", sys: "158", dia: "96", flag: "high" as const, ctx: "morning" as const },
    { id: BP[1], at: "2026-06-09T07:45:00+05:30", sys: "162", dia: "98", flag: "high" as const, ctx: "morning" as const },
    { id: BP[2], at: "2026-06-15T08:25:00+05:30", sys: "155", dia: "94", flag: "high" as const, ctx: "morning" as const },
    { id: BP[3], at: "2026-06-12T19:00:00+05:30", sys: "128", dia: "82", flag: "normal" as const, ctx: "evening" as const },
  ];
  await db
    .insert(vitalReadings)
    .values(
      bpRows.map((b) => ({
        id: b.id,
        patientId: STUB_PATIENT_ID,
        readingType: "blood_pressure" as const,
        recordedAt: new Date(b.at),
        valuePrimary: b.sys,
        valueSecondary: b.dia,
        unit: "mmHg",
        context: b.ctx,
        flag: b.flag,
      })),
    )
    .onConflictDoNothing({ target: vitalReadings.id });

  // --- Insights (placeholder; Phase E's generator replaces these) ----------

  const insightRows = [
    {
      id: INS[0],
      generatedAt: new Date("2026-06-19T09:00:00+05:30"),
      status: "new" as const,
      severity: "attention" as const,
      category: "pattern" as const,
      title: "Dizziness is clustering on mornings with elevated blood pressure",
      body:
        "Over the last three weeks, **four** dizziness episodes (§ symptom: dizziness) have clustered in the **morning** — Jun 2, Jun 9, Jun 15, and Jun 19, all between **07:40 and 08:30**.\n\nOn three of those mornings a blood-pressure reading was **elevated** (158/96, 162/98, 155/94 mmHg). The pattern lines up with mornings rather than any other time of day.\n\nThe cardiologist raised the **amlodipine** (§ med: amlodipine) dose to **10 mg** on Apr 3. It's worth raising at the next visit whether the morning dose is being taken consistently — the timing is consistent with blood pressure not yet controlled in the early morning.",
      triggeredBy: { type: "symptom-episode", id: EP[3] },
      linkedEntities: [
        { type: "med", id: AMLODIPINE },
        { type: "symptom", id: DIZZINESS },
      ],
      citedSources: [
        { type: "med", id: AMLODIPINE, snippet: "Amlodipine 10 mg once daily" },
        { type: "symptom", id: DIZZINESS, snippet: "Dizziness (4 episodes logged)" },
        { type: "symptom-episode", id: EP[0], snippet: "Episode · Jun 2, 2026 — mild, morning" },
        { type: "symptom-episode", id: EP[1], snippet: "Episode · Jun 9, 2026 — moderate, morning" },
        { type: "symptom-episode", id: EP[3], snippet: "Episode · Jun 19, 2026 — moderate, morning" },
        { type: "vital", id: BP[0], snippet: "BP 158/96 mmHg · Jun 2, 2026 (morning)" },
        { type: "vital", id: BP[1], snippet: "BP 162/98 mmHg · Jun 9, 2026 (morning)" },
        { type: "vital", id: BP[2], snippet: "BP 155/94 mmHg · Jun 15, 2026 (morning)" },
      ],
    },
    {
      id: INS[1],
      generatedAt: new Date("2026-06-15T09:30:00+05:30"),
      status: "new" as const,
      severity: "watch" as const,
      category: "risk" as const,
      title: "Three morning systolic readings above 155 this month",
      body:
        "There have been **three** morning blood-pressure readings above **155/90 mmHg** in June — 158/96, 162/98, and 155/94. The one evening reading logged (128/82) was in range.\n\nThis is a morning-specific elevation while on **amlodipine** (§ med: amlodipine) 10 mg. Worth flagging the morning numbers specifically at the next cardiology visit.",
      triggeredBy: { type: "vital", id: BP[2] },
      linkedEntities: [{ type: "med", id: AMLODIPINE }],
      citedSources: [
        { type: "med", id: AMLODIPINE, snippet: "Amlodipine 10 mg once daily" },
        { type: "vital", id: BP[0], snippet: "BP 158/96 mmHg · Jun 2, 2026 (morning)" },
        { type: "vital", id: BP[1], snippet: "BP 162/98 mmHg · Jun 9, 2026 (morning)" },
        { type: "vital", id: BP[2], snippet: "BP 155/94 mmHg · Jun 15, 2026 (morning)" },
      ],
    },
    {
      id: INS[2],
      generatedAt: new Date("2026-06-10T08:00:00+05:30"),
      status: "seen" as const,
      severity: "watch" as const,
      category: "trend" as const,
      title: "Morning blood pressure has been trending up since early June",
      body:
        "Morning systolic readings have moved **158 → 162** over the first two weeks of June. It's a short series — **two** morning readings so far — so this is early, not yet a confirmed trend.\n\nA couple more morning readings would make the direction clear. Logged here so it isn't lost if the pattern continues.",
      triggeredBy: { type: "vital", id: BP[1] },
      linkedEntities: [{ type: "med", id: AMLODIPINE }],
      citedSources: [
        { type: "vital", id: BP[0], snippet: "BP 158/96 mmHg · Jun 2, 2026 (morning)" },
        { type: "vital", id: BP[1], snippet: "BP 162/98 mmHg · Jun 9, 2026 (morning)" },
      ],
    },
    {
      id: INS[3],
      generatedAt: new Date("2026-05-28T08:00:00+05:30"),
      status: "acknowledged" as const,
      severity: "informational" as const,
      category: "gap" as const,
      title: "No kidney-function panel logged since the amlodipine dose increase",
      body:
        "The **amlodipine** (§ med: amlodipine) dose was raised on **Apr 3**. There's no kidney-function or electrolyte panel in the record since then.\n\nThis may simply be untracked rather than not done — worth confirming whether routine bloodwork has been ordered.",
      triggeredBy: { type: "med", id: AMLODIPINE },
      linkedEntities: [{ type: "med", id: AMLODIPINE }],
      citedSources: [
        { type: "med", id: AMLODIPINE, snippet: "Amlodipine 10 mg once daily (raised Apr 3)" },
      ],
    },
    {
      id: INS[4],
      generatedAt: new Date("2026-05-05T08:00:00+05:30"),
      status: "acted_on" as const,
      severity: "watch" as const,
      category: "gap" as const,
      title: "Amlodipine dose raised Apr 3 — first follow-up reading came three weeks later",
      body:
        "After the **amlodipine** (§ med: amlodipine) increase to **10 mg** on Apr 3, a follow-up blood-pressure check within a week or two is the usual cadence to confirm the new dose is holding.\n\nNoted for the next visit so the follow-up rhythm stays on the radar.",
      triggeredBy: { type: "med", id: AMLODIPINE },
      linkedEntities: [{ type: "med", id: AMLODIPINE }],
      citedSources: [
        { type: "med", id: AMLODIPINE, snippet: "Amlodipine 10 mg once daily (raised Apr 3)" },
      ],
      // The §6.9:1629 editorial layer — demonstrates a populated Notes section.
      notes:
        "Raised this with Dr. Sharma at the May visit. Going forward she wants a BP reading logged the week after any dose change.",
    },
  ];

  await db
    .insert(insights)
    .values(
      insightRows.map((i) => ({
        ...i,
        patientId: STUB_PATIENT_ID,
        modelVersion: MODEL_VERSION,
      })),
    )
    .onConflictDoNothing({ target: insights.id });

  const [row] = await db
    .select({ id: patients.id, name: patients.name })
    .from(patients)
    .where(sql`${patients.id} = ${STUB_PATIENT_ID}`);

  console.log(`seeded: ${row?.id} (${row?.name})`);
  console.log(`  + demo vault: 1 doctor, 1 medication (+1 change), 1 symptom type (4 episodes), 4 vitals`);
  console.log(`  + ${insightRows.length} insights`);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
