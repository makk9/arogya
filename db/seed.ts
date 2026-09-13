import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import { env } from "@/lib/env";
import { STUB_PATIENT_ID, STUB_USER_ID } from "@/lib/auth";
import {
  allergies,
  allergyChanges,
  conditionChanges,
  conditions,
  doctors,
  familyHistory,
  journalEntries,
  labReports,
  labResults,
  lifestyleProfiles,
  medicationChanges,
  medications,
  patients,
  reports,
  symptomEpisodes,
  symptomTypes,
  visits,
  vitalReadings,
} from "@/db/schema";

/*
 * Seed: a full, coherent demo vault for one realistic aging patient —
 * Relangi Mavayya, 76, Hyderabad. Replaces the earlier Phase-D
 * mini-vault (Ramesh Sharma) and any hand-entered test data.
 *
 * The record is deliberately built so the §1.3 synthesis demo lands: multiple
 * doctors, change logs, lab trends, and symptom clusters that *cross* entities
 * — e.g. an NSAID discontinued because kidney function is slipping, dizziness
 * clustering after a BP-med dose increase, HbA1c climbing across three panels.
 *
 * This is a DESTRUCTIVE reset: every table is truncated before reseeding (the
 * dev DB only holds disposable test data). Re-running gives a clean, identical
 * vault.
 *
 * No insights are seeded: the E5 generator (lib/agents/insight-generator.ts)
 * is the only writer of insight rows — the feed starts empty and fills with
 * real output as the vault changes (retired 2026-07-20, decisions.md).
 */

// ── Helpers ────────────────────────────────────────────────────────────────
const id = () => randomUUID();
// Asia/Kolkata is +05:30 — all wall-clock times below are local to Hyderabad.
const ist = (s: string) => new Date(`${s}+05:30`);

async function main() {
  const client = postgres(env.DATABASE_URL, { prepare: false });
  const db = drizzle(client);

  // ── Wipe ───────────────────────────────────────────────────────────────
  // Truncate everything; CASCADE clears child rows in one shot. Order doesn't
  // matter with CASCADE, but we name the roots explicitly for clarity.
  await db.execute(sql`
    TRUNCATE TABLE
      patients,
      doctors, doctor_changes,
      conditions, condition_changes,
      medications, medication_changes,
      allergies, allergy_changes,
      lifestyle_profiles, lifestyle_changes,
      family_history,
      visits,
      lab_reports, lab_results,
      vital_readings,
      symptom_types, symptom_episodes,
      reports,
      journal_entries,
      insights, insight_runs,
      extraction_sessions
    RESTART IDENTITY CASCADE
  `);

  // ── Patient ──────────────────────────────────────────────────────────────
  await db.insert(patients).values({
    id: STUB_PATIENT_ID,
    ownerUserId: STUB_USER_ID,
    name: "Relangi Mavayya",
    preferredName: "Relangi",
    dateOfBirth: "1949-03-12",
    sex: "male",
    bloodType: "B+",
    heightCm: "168",
    currentWeightKg: "71",
    country: "India",
    city: "Hyderabad",
    timezone: "Asia/Kolkata",
    notes:
      "Retired schoolteacher, lives in Hyderabad with his wife Lakshmi. Grandson (account holder) is in the US and coordinates care remotely. Generally independent; manages his own medications with a weekly pill organizer. Hindi and Telugu speaker, comfortable in English.",
  });

  // ── Doctors ──────────────────────────────────────────────────────────────
  const drPadma = id(); // GP / internal medicine — the quarterback
  const drSrinivas = id(); // endocrinology — diabetes + CKD oversight
  const drKavita = id(); // cardiology — BP + lipids
  const drArjun = id(); // orthopedics — knees
  const drMohan = id(); // nephrology — CKD

  await db.insert(doctors).values([
    {
      id: drPadma,
      patientId: STUB_PATIENT_ID,
      name: "Dr. Padma Reddy",
      specialty: "Internal Medicine",
      clinic: "Apollo Clinic, Jubilee Hills, Hyderabad",
      phone: "+91 40 2355 1234",
      firstVisit: "2016-02-18",
      notes:
        "Primary physician and the main point of contact. Coordinates referrals across the specialists.",
    },
    {
      id: drSrinivas,
      patientId: STUB_PATIENT_ID,
      name: "Dr. Srinivas Rao",
      specialty: "Endocrinology",
      clinic: "Apollo Hospitals, Jubilee Hills, Hyderabad",
      phone: "+91 40 2360 5678",
      firstVisit: "2016-04-02",
    },
    {
      id: drKavita,
      patientId: STUB_PATIENT_ID,
      name: "Dr. Kavita Menon",
      specialty: "Cardiology",
      clinic: "CARE Hospitals, Banjara Hills, Hyderabad",
      phone: "+91 40 3041 7777",
      firstVisit: "2018-07-21",
    },
    {
      id: drArjun,
      patientId: STUB_PATIENT_ID,
      name: "Dr. Arjun Iyer",
      specialty: "Orthopedics",
      clinic: "Sunshine Hospitals, Secunderabad",
      firstVisit: "2019-11-09",
    },
    {
      id: drMohan,
      patientId: STUB_PATIENT_ID,
      name: "Dr. Mohan Krishna",
      specialty: "Nephrology",
      clinic: "Apollo Hospitals, Jubilee Hills, Hyderabad",
      firstVisit: "2023-08-14",
    },
  ]);

  // ── Conditions ───────────────────────────────────────────────────────────
  const cDiabetes = id();
  const cHypertension = id();
  const cDyslipidemia = id();
  const cCKD = id();
  const cKneeOA = id();
  const cBPH = id();

  await db.insert(conditions).values([
    {
      id: cDiabetes,
      patientId: STUB_PATIENT_ID,
      name: "Type 2 Diabetes Mellitus",
      category: "endocrine",
      icdCode: "E11.9",
      status: "active",
      severity: "moderate",
      diagnosedOn: "2009-06-15",
      diagnosedBy: drSrinivas,
      managingDoctor: drSrinivas,
      notes:
        "Diagnosed ~16 years ago. Well-controlled for most of that time on metformin; control has slipped over the last year (see HbA1c trend), prompting a glimepiride dose increase.",
    },
    {
      id: cHypertension,
      patientId: STUB_PATIENT_ID,
      name: "Hypertension",
      category: "cardiovascular",
      icdCode: "I10",
      status: "controlled",
      severity: "moderate",
      diagnosedOn: "2011-03-02",
      diagnosedBy: drPadma,
      managingDoctor: drKavita,
      notes: "Managed with telmisartan. Mostly controlled; occasional morning spikes.",
    },
    {
      id: cDyslipidemia,
      patientId: STUB_PATIENT_ID,
      name: "Dyslipidemia",
      category: "cardiovascular",
      icdCode: "E78.5",
      status: "active",
      severity: "mild",
      diagnosedOn: "2013-09-10",
      diagnosedBy: drKavita,
      managingDoctor: drKavita,
      notes: "On atorvastatin. LDL at goal, but HDL persistently low and triglycerides elevated.",
    },
    {
      id: cCKD,
      patientId: STUB_PATIENT_ID,
      name: "Chronic Kidney Disease",
      category: "renal",
      icdCode: "N18.3",
      status: "active",
      severity: "moderate",
      diagnosedOn: "2023-08-14",
      diagnosedBy: drMohan,
      managingDoctor: drMohan,
      notes:
        "Stage 3a (eGFR ~50), most likely diabetic nephropathy. Telmisartan is renoprotective. NSAIDs avoided since diagnosis.",
    },
    {
      id: cKneeOA,
      patientId: STUB_PATIENT_ID,
      name: "Osteoarthritis of the Knees",
      category: "musculoskeletal",
      icdCode: "M17.0",
      status: "active",
      severity: "moderate",
      diagnosedOn: "2019-11-09",
      diagnosedBy: drArjun,
      managingDoctor: drArjun,
      notes: "Bilateral, right worse than left. Limits his morning walks on bad days.",
    },
    {
      id: cBPH,
      patientId: STUB_PATIENT_ID,
      name: "Benign Prostatic Hyperplasia",
      category: "other",
      icdCode: "N40.1",
      status: "controlled",
      severity: "mild",
      diagnosedOn: "2021-05-20",
      diagnosedBy: drPadma,
      managingDoctor: drPadma,
      notes: "Nocturia 1–2x/night. Stable on tamsulosin.",
    },
  ]);

  await db.insert(conditionChanges).values([
    {
      conditionId: cDiabetes,
      changedAt: ist("2015-01-20T11:00:00"),
      field: "status",
      oldValue: "active",
      newValue: "controlled",
      reason: "HbA1c held under 7% for over a year on metformin alone.",
    },
    {
      conditionId: cDiabetes,
      changedAt: ist("2026-06-15T10:30:00"),
      field: "status",
      oldValue: "controlled",
      newValue: "active",
      reason: "HbA1c climbed to 8.1%; control no longer adequate.",
    },
    {
      conditionId: cCKD,
      changedAt: ist("2023-08-14T09:30:00"),
      field: "severity",
      oldValue: null,
      newValue: "moderate",
      reason: "Confirmed Stage 3a on first nephrology review.",
    },
    {
      conditionId: cHypertension,
      changedAt: ist("2019-05-12T10:00:00"),
      field: "status",
      oldValue: "active",
      newValue: "controlled",
      reason: "BP consistently at target after telmisartan dose adjustment.",
    },
  ]);

  // Visit ids are declared up here so medication_changes (inserted below, before
  // the visit rows themselves) can set linked_visit_id to the visit that
  // prompted a dose change. The visits are inserted further down.
  const visOrthoDec = id();
  const visGpMar = id();
  const visNephroApr = id();
  const visCardioMay = id();
  const visEndoJun = id();
  const visEndoUpcoming = id();
  const visOrthoCancelled = id(); // edge case: a cancelled visit

  // ── Medications ──────────────────────────────────────────────────────────
  const mMetformin = id();
  const mGlimepiride = id();
  const mTelmisartan = id();
  const mAtorvastatin = id();
  const mTamsulosin = id();
  const mAspirin = id();
  const mCalcium = id();
  const mBoswellia = id();
  const mDiclofenac = id(); // discontinued — the CKD cross-thread
  const mFerrous = id(); // paused — anemia of CKD, held for GI upset

  await db.insert(medications).values([
    {
      id: mMetformin,
      patientId: STUB_PATIENT_ID,
      name: "Metformin",
      brandName: "Glycomet",
      form: "tablet",
      currentDose: "1000 mg",
      currentFrequency: "twice daily",
      purpose: cDiabetes,
      prescribingDoctor: drSrinivas,
      category: "allopathic",
      startedOn: "2009-06-20",
      status: "active",
      notes: "Taken with breakfast and dinner. Well tolerated.",
    },
    {
      id: mGlimepiride,
      patientId: STUB_PATIENT_ID,
      name: "Glimepiride",
      brandName: "Amaryl",
      form: "tablet",
      currentDose: "2 mg",
      currentFrequency: "once daily",
      purpose: cDiabetes,
      prescribingDoctor: drSrinivas,
      category: "allopathic",
      startedOn: "2024-02-10",
      status: "active",
      notes: "Added when metformin alone stopped holding HbA1c. Dose raised to 2 mg in June 2026.",
    },
    {
      id: mTelmisartan,
      patientId: STUB_PATIENT_ID,
      name: "Telmisartan",
      brandName: "Telma",
      form: "tablet",
      currentDose: "40 mg",
      currentFrequency: "once daily",
      purpose: cHypertension,
      prescribingDoctor: drKavita,
      category: "allopathic",
      startedOn: "2011-03-10",
      status: "active",
      notes: "Renoprotective ARB — kept on for both BP and CKD. Dose raised from 20 mg to 40 mg in May 2026.",
    },
    {
      id: mAtorvastatin,
      patientId: STUB_PATIENT_ID,
      name: "Atorvastatin",
      brandName: "Atorva",
      form: "tablet",
      currentDose: "20 mg",
      currentFrequency: "once at night",
      purpose: cDyslipidemia,
      prescribingDoctor: drKavita,
      category: "allopathic",
      startedOn: "2013-09-15",
      status: "active",
    },
    {
      id: mTamsulosin,
      patientId: STUB_PATIENT_ID,
      name: "Tamsulosin",
      brandName: "Urimax",
      form: "capsule",
      currentDose: "0.4 mg",
      currentFrequency: "once daily at bedtime",
      purpose: cBPH,
      prescribingDoctor: drPadma,
      category: "allopathic",
      startedOn: "2021-05-25",
      status: "active",
      notes: "Can contribute to lightheadedness on standing — relevant to the dizziness reports.",
    },
    {
      id: mAspirin,
      patientId: STUB_PATIENT_ID,
      name: "Aspirin",
      brandName: "Ecosprin",
      form: "tablet",
      currentDose: "75 mg",
      currentFrequency: "once daily",
      prescribingDoctor: drKavita,
      category: "allopathic",
      startedOn: "2018-07-21",
      status: "active",
      notes: "Cardioprotective, given the diabetes + hypertension risk profile.",
    },
    {
      id: mCalcium,
      patientId: STUB_PATIENT_ID,
      name: "Calcium + Vitamin D3",
      brandName: "Shelcal",
      form: "tablet",
      currentDose: "500 mg / 250 IU",
      currentFrequency: "once daily",
      category: "supplement",
      startedOn: "2020-01-15",
      status: "active",
      notes: "Vitamin D was low on the last panel — worth confirming the dose is adequate.",
    },
    {
      id: mBoswellia,
      patientId: STUB_PATIENT_ID,
      name: "Boswellia (Shallaki)",
      form: "tablet",
      currentDose: "400 mg",
      currentFrequency: "twice daily",
      purpose: cKneeOA,
      category: "ayurvedic",
      startedOn: "2022-03-01",
      status: "active",
      notes: "Self-started for knee pain; Dr. Iyer aware and has no objection.",
    },
    {
      id: mDiclofenac,
      patientId: STUB_PATIENT_ID,
      name: "Diclofenac",
      brandName: "Voveran",
      form: "tablet",
      currentDose: "50 mg",
      currentFrequency: "as needed",
      purpose: cKneeOA,
      prescribingDoctor: drArjun,
      category: "allopathic",
      startedOn: "2019-11-12",
      status: "discontinued",
      discontinuedOn: "2023-08-20",
      discontinuationReason:
        "Stopped on nephrology advice after CKD diagnosis — NSAIDs accelerate kidney decline. Switched to topical diclofenac gel and paracetamol for knee pain.",
    },
    {
      id: mFerrous,
      patientId: STUB_PATIENT_ID,
      name: "Ferrous Ascorbate",
      brandName: "Orofer-XT",
      form: "tablet",
      currentDose: "100 mg",
      currentFrequency: "once daily",
      prescribingDoctor: drMohan,
      category: "allopathic",
      startedOn: "2026-02-12",
      status: "paused",
      notes:
        "Started for mild anemia of CKD. Paused in May — caused constipation; Dr. Mohan to reassess iron studies before restarting.",
    },
  ]);

  // medication_changes are inserted AFTER the visits block (below): a change can
  // carry linked_visit_id, so the visit row must already exist.

  // ── Allergies ────────────────────────────────────────────────────────────
  const aSulfa = id();
  const aPenicillin = id();

  await db.insert(allergies).values([
    {
      id: aSulfa,
      patientId: STUB_PATIENT_ID,
      substance: "Sulfa drugs (sulfamethoxazole)",
      category: "drug",
      reaction: "Itchy rash over the trunk within a day of starting.",
      severity: "moderate",
      firstNoted: "2014-04-10",
      confirmedBy: drPadma,
      status: "active",
      notes: "Flagged on his chart so antibiotics avoid this class.",
    },
    {
      id: aPenicillin,
      patientId: STUB_PATIENT_ID,
      substance: "Penicillin",
      category: "drug",
      reaction: "Reported hives as a younger man; never formally tested.",
      severity: "unknown",
      status: "suspected",
    },
  ]);

  await db.insert(allergyChanges).values([
    {
      allergyId: aSulfa,
      changedAt: ist("2014-04-12T09:00:00"),
      field: "status",
      oldValue: "suspected",
      newValue: "active",
      reason: "Rash recurred on re-exposure — confirmed by Dr. Reddy.",
    },
  ]);

  // ── Lifestyle (singleton) ────────────────────────────────────────────────
  await db.insert(lifestyleProfiles).values({
    patientId: STUB_PATIENT_ID,
    dietPattern:
      "Vegetarian South Indian — traditionally rice-heavy. The family has been cutting back on white rice and sugar to help his diabetes; more millets and vegetables now.",
    dietRestrictions: ["vegetarian", "low_sugar", "low_salt"],
    exercisePattern:
      "Morning walks of about 30 minutes, 4–5 days a week in the colony park. Skips them on days his knees are bad.",
    exerciseIntensity: "light",
    sleepPattern: "About 6–7 hours; wakes once or twice at night to urinate (BPH).",
    stressLevel: "low",
    stressContext: "Retired and settled; mild anxiety mainly around hospital visits and lab results.",
    tobaccoUse: "former",
    alcoholUse: "never",
    notes: "Quit smoking around 2003 after ~20 years of light smoking. Never drank.",
  });

  // ── Family history ───────────────────────────────────────────────────────
  await db.insert(familyHistory).values([
    {
      patientId: STUB_PATIENT_ID,
      relation: "parent",
      relationSpecific: "Father",
      conditionName: "Type 2 Diabetes",
      ageOfOnset: 58,
      outcome: "Lived into his 80s; later developed kidney problems.",
    },
    {
      patientId: STUB_PATIENT_ID,
      relation: "parent",
      relationSpecific: "Mother",
      conditionName: "Hypertension",
      ageOfOnset: 55,
      outcome: "Passed away at 79 from a stroke.",
    },
    {
      patientId: STUB_PATIENT_ID,
      relation: "sibling",
      relationSpecific: "Elder brother",
      conditionName: "Coronary artery disease",
      ageOfOnset: 62,
      outcome: "Had a heart attack at 64; recovered after a stent.",
    },
  ]);

  // ── Visits ───────────────────────────────────────────────────────────────
  // (ids hoisted above the Medications block so med changes can link to them.)
  await db.insert(visits).values([
    {
      id: visOrthoDec,
      patientId: STUB_PATIENT_ID,
      doctorId: drArjun,
      visitDate: "2025-12-03",
      visitType: "routine_followup",
      chiefComplaint: "Right knee pain worse in cold weather.",
      summary:
        "Bilateral knee osteoarthritis, right worse than left. Reinforced to avoid oral NSAIDs given CKD; continue topical gel, paracetamol, and quadriceps exercises.",
      diagnosisText: "Osteoarthritis of the knees, progressing.",
      nextSteps: "Physiotherapy referral; review in 6 months.",
      status: "completed",
    },
    {
      id: visGpMar,
      patientId: STUB_PATIENT_ID,
      doctorId: drPadma,
      visitDate: "2026-03-18",
      visitType: "routine_followup",
      chiefComplaint: "Routine quarterly review; refills.",
      summary:
        "General review. BP slightly up in clinic. Ordered fasting labs ahead of the endocrinology and cardiology visits. BPH stable.",
      nextSteps: "Get fasting bloods done; follow up with specialists.",
      status: "completed",
    },
    {
      id: visNephroApr,
      patientId: STUB_PATIENT_ID,
      doctorId: drMohan,
      visitDate: "2026-04-22",
      visitType: "routine_followup",
      chiefComplaint: "CKD surveillance.",
      summary:
        "eGFR trending down slowly. Reinforced strict NSAID avoidance and good hydration. Telmisartan continued for renoprotection. Asked cardiology to keep BP well controlled.",
      diagnosisText: "CKD Stage 3a, slowly progressive.",
      nextSteps: "Repeat renal panel in 3 months; keep BP at target.",
      status: "completed",
    },
    {
      id: visCardioMay,
      patientId: STUB_PATIENT_ID,
      doctorId: drKavita,
      visitDate: "2026-05-08",
      visitType: "routine_followup",
      chiefComplaint: "Morning BP readings creeping up.",
      summary:
        "Home BP log showed morning readings above target. Raised telmisartan from 20 mg to 40 mg. Lipids acceptable for LDL but HDL low — continue atorvastatin, emphasize diet and activity.",
      diagnosisText: "Hypertension, sub-optimally controlled; dyslipidemia.",
      nextSteps: "Re-check home BP over the next month; repeat lipid panel.",
      status: "completed",
    },
    {
      id: visEndoJun,
      patientId: STUB_PATIENT_ID,
      doctorId: drSrinivas,
      visitDate: "2026-06-15",
      visitType: "routine_followup",
      chiefComplaint: "Diabetes review; HbA1c up.",
      summary:
        "HbA1c 8.1%, up from 7.6% in January. Raised glimepiride from 1 mg to 2 mg. Reviewed diet. Flagged that no diabetic eye or foot screening is on record this year.",
      diagnosisText: "Type 2 diabetes, control worsening.",
      nextSteps: "Recheck HbA1c in 3 months; arrange retinal and foot screening.",
      status: "completed",
    },
    {
      id: visEndoUpcoming,
      patientId: STUB_PATIENT_ID,
      doctorId: drSrinivas,
      visitDate: "2026-09-20",
      visitType: "routine_followup",
      chiefComplaint: "Diabetes follow-up after dose change.",
      summary: null,
      nextSteps: null,
      status: "scheduled",
    },
    {
      id: visOrthoCancelled,
      patientId: STUB_PATIENT_ID,
      doctorId: drArjun,
      visitDate: "2026-06-05",
      visitType: "routine_followup",
      chiefComplaint: "Knee physiotherapy review.",
      summary: null,
      nextSteps: null,
      status: "cancelled",
      notes: "Cancelled — he was unwell that morning; to be rebooked.",
    },
  ]);

  // ── Medication changes ───────────────────────────────────────────────────
  // (after visits so linked_visit_id FKs resolve)
  await db.insert(medicationChanges).values([
    {
      medicationId: mMetformin,
      changedAt: ist("2012-08-10T11:00:00"),
      field: "dose",
      oldValue: "500 mg",
      newValue: "1000 mg",
      reason: "HbA1c above target on the lower dose.",
    },
    {
      medicationId: mGlimepiride,
      changedAt: ist("2026-06-15T10:30:00"),
      field: "dose",
      oldValue: "1 mg",
      newValue: "2 mg",
      reason: "HbA1c rose to 8.1% despite metformin + glimepiride 1 mg.",
      linkedVisitId: visEndoJun,
    },
    {
      medicationId: mTelmisartan,
      changedAt: ist("2026-05-08T10:00:00"),
      field: "dose",
      oldValue: "20 mg",
      newValue: "40 mg",
      reason: "Morning BP readings creeping above target.",
      linkedVisitId: visCardioMay,
    },
    {
      medicationId: mDiclofenac,
      changedAt: ist("2023-08-20T15:00:00"),
      field: "status",
      oldValue: "active",
      newValue: "discontinued",
      reason: "Discontinued to protect kidney function after CKD diagnosis.",
    },
    {
      medicationId: mFerrous,
      changedAt: ist("2026-05-14T09:00:00"),
      field: "status",
      oldValue: "active",
      newValue: "paused",
      reason:
        "Causing constipation; Dr. Mohan to reassess iron studies before restarting.",
    },
  ]);

  // ── Lab reports + results ────────────────────────────────────────────────
  const lrJul25 = id();
  const lrJan26 = id();
  const lrJun26 = id();

  await db.insert(labReports).values([
    {
      id: lrJul25,
      patientId: STUB_PATIENT_ID,
      reportDate: "2025-07-05",
      reportType: "Diabetes & renal panel",
      labName: "Vijaya Diagnostics, Himayatnagar",
      orderedBy: drSrinivas,
      summary: "Baseline panel — HbA1c 7.2%, kidney function mildly reduced.",
    },
    {
      id: lrJan26,
      patientId: STUB_PATIENT_ID,
      reportDate: "2026-01-10",
      // Same reportType as the June panel so it surfaces under June's "previous
      // panels of this type" linked context.
      reportType: "Comprehensive metabolic, renal & lipid panel",
      labName: "Vijaya Diagnostics, Himayatnagar",
      orderedBy: drPadma,
      summary:
        "HbA1c up to 7.6%; eGFR slightly lower; LDL elevated. Potassium critically high at 6.1 — flagged by the lab, nephrology contacted same day.",
    },
    {
      id: lrJun26,
      patientId: STUB_PATIENT_ID,
      reportDate: "2026-06-15",
      reportType: "Comprehensive metabolic, renal & lipid panel",
      labName: "Apollo Diagnostics, Jubilee Hills",
      orderedBy: drSrinivas,
      linkedVisitId: visEndoJun,
      summary:
        "HbA1c 8.1% (up again), eGFR 50 (down), low HDL and high triglycerides, low vitamin D.",
    },
  ]);

  // [marker, normalized, value, unit, refLow, refHigh, flag, linkedCondition]
  type R = [string, string, string, string, string | null, string | null, "normal" | "low" | "high" | "critical", string | null];
  const julResults: R[] = [
    ["HbA1c", "hba1c", "7.2", "%", "4.0", "5.6", "high", cDiabetes],
    ["Creatinine", "creatinine", "1.2", "mg/dL", "0.7", "1.3", "normal", cCKD],
    ["eGFR", "egfr", "62", "mL/min/1.73m²", "60", null, "normal", cCKD],
  ];
  const janResults: R[] = [
    ["HbA1c", "hba1c", "7.6", "%", "4.0", "5.6", "high", cDiabetes],
    ["Creatinine", "creatinine", "1.3", "mg/dL", "0.7", "1.3", "normal", cCKD],
    ["eGFR", "egfr", "58", "mL/min/1.73m²", "60", null, "low", cCKD],
    // Edge case: a critically-high marker (red register). Resolved by June (4.8).
    ["Potassium", "potassium", "6.1", "mmol/L", "3.5", "5.1", "critical", cCKD],
    ["LDL Cholesterol", "ldl-cholesterol", "112", "mg/dL", null, "100", "high", cDyslipidemia],
  ];
  const junResults: R[] = [
    ["HbA1c", "hba1c", "8.1", "%", "4.0", "5.6", "high", cDiabetes],
    ["Fasting Glucose", "fasting-glucose", "148", "mg/dL", "70", "100", "high", cDiabetes],
    ["Creatinine", "creatinine", "1.5", "mg/dL", "0.7", "1.3", "high", cCKD],
    ["eGFR", "egfr", "50", "mL/min/1.73m²", "60", null, "low", cCKD],
    ["Potassium", "potassium", "4.8", "mmol/L", "3.5", "5.1", "normal", cCKD],
    ["Total Cholesterol", "total-cholesterol", "168", "mg/dL", null, "200", "normal", cDyslipidemia],
    ["LDL Cholesterol", "ldl-cholesterol", "95", "mg/dL", null, "100", "normal", cDyslipidemia],
    ["HDL Cholesterol", "hdl-cholesterol", "36", "mg/dL", "40", null, "low", cDyslipidemia],
    ["Triglycerides", "triglycerides", "190", "mg/dL", null, "150", "high", cDyslipidemia],
    ["Vitamin D (25-OH)", "vitamin-d", "18", "ng/mL", "30", "100", "low", null],
  ];

  const labRows = [
    { reportId: lrJul25, date: "2025-07-05", rows: julResults },
    { reportId: lrJan26, date: "2026-01-10", rows: janResults },
    { reportId: lrJun26, date: "2026-06-15", rows: junResults },
  ].flatMap(({ reportId, date, rows }) =>
    rows.map(([marker, normalized, value, unit, refLow, refHigh, flag, cond]) => ({
      labReportId: reportId,
      patientId: STUB_PATIENT_ID,
      marker,
      markerNormalized: normalized,
      value,
      unit,
      referenceLow: refLow,
      referenceHigh: refHigh,
      flag,
      resultDate: date,
      linkedCondition: cond,
    })),
  );
  await db.insert(labResults).values(labRows);

  // ── Symptom types + episodes ─────────────────────────────────────────────
  const stKnee = id();
  const stDizzy = id();
  const stFatigue = id();

  await db.insert(symptomTypes).values([
    {
      id: stKnee,
      patientId: STUB_PATIENT_ID,
      name: "Knee Pain",
      bodyArea: "legs",
      linkedCondition: cKneeOA,
      firstNoted: "2019-10-01",
      status: "active",
      notes: "Bilateral, right worse. Stiff in the mornings and after long walks.",
    },
    {
      id: stDizzy,
      patientId: STUB_PATIENT_ID,
      name: "Dizziness",
      bodyArea: "head",
      firstNoted: "2026-05-15",
      status: "monitoring",
      notes: "Lightheaded on standing, mostly mornings. Started around the telmisartan dose increase.",
    },
    {
      id: stFatigue,
      patientId: STUB_PATIENT_ID,
      name: "Fatigue",
      bodyArea: "general",
      firstNoted: "2026-06-01",
      status: "monitoring",
      notes: "Low energy in the afternoons; coincides with higher blood sugars.",
    },
  ]);

  await db.insert(symptomEpisodes).values([
    {
      symptomTypeId: stKnee,
      patientId: STUB_PATIENT_ID,
      startedAt: ist("2026-05-28T07:30:00"),
      severity: "moderate",
      description: "Stiff and sore on waking; eased after moving around.",
      triggers: "Morning, cold weather",
      relief: "Warm compress, gentle movement",
    },
    {
      symptomTypeId: stKnee,
      patientId: STUB_PATIENT_ID,
      startedAt: ist("2026-06-10T18:00:00"),
      severity: "moderate",
      description: "Ache in the right knee after the evening walk.",
      triggers: "Long walk",
      relief: "Rest, topical gel",
    },
    {
      symptomTypeId: stKnee,
      patientId: STUB_PATIENT_ID,
      startedAt: ist("2026-06-18T08:00:00"),
      severity: "mild",
      description: "Mild morning stiffness only.",
      triggers: "Morning",
    },
    {
      symptomTypeId: stDizzy,
      patientId: STUB_PATIENT_ID,
      startedAt: ist("2026-05-22T07:50:00"),
      severity: "mild",
      description: "Briefly lightheaded standing up from bed.",
      triggers: "Standing up, morning",
    },
    {
      symptomTypeId: stDizzy,
      patientId: STUB_PATIENT_ID,
      startedAt: ist("2026-06-03T07:40:00"),
      severity: "moderate",
      description: "Had to steady himself on the wall for a few seconds after standing.",
      triggers: "Standing up, morning, before breakfast",
      // Surfaces under the May cardiology visit's "Linked context" (the visit
      // that raised telmisartan, after which the dizziness emerged).
      linkedVisitId: visCardioMay,
    },
    {
      symptomTypeId: stDizzy,
      patientId: STUB_PATIENT_ID,
      startedAt: ist("2026-06-12T07:55:00"),
      severity: "mild",
      description: "Momentary lightheadedness on getting out of bed.",
      triggers: "Standing up, morning",
    },
    {
      symptomTypeId: stFatigue,
      patientId: STUB_PATIENT_ID,
      startedAt: ist("2026-06-12T15:00:00"),
      severity: "mild",
      description: "Noticeably tired and sluggish through the afternoon.",
      triggers: "After lunch",
    },
  ]);

  // ── Vital readings ───────────────────────────────────────────────────────
  type V = {
    type: "blood_pressure" | "weight" | "blood_glucose" | "heart_rate";
    at: string;
    primary: string;
    secondary?: string;
    unit: string;
    context?: "fasting" | "post_meal" | "morning" | "evening" | "pre_medication" | "post_medication" | "other";
    flag?: "normal" | "low" | "high" | "critical";
  };
  const vitals: V[] = [
    // Morning BP log — elevated before the telmisartan increase, settling after.
    { type: "blood_pressure", at: "2026-05-02T07:30:00", primary: "150", secondary: "92", unit: "mmHg", context: "morning", flag: "high" },
    { type: "blood_pressure", at: "2026-05-06T07:30:00", primary: "152", secondary: "94", unit: "mmHg", context: "morning", flag: "high" },
    { type: "blood_pressure", at: "2026-05-20T19:00:00", primary: "134", secondary: "84", unit: "mmHg", context: "evening", flag: "normal" },
    { type: "blood_pressure", at: "2026-06-09T07:35:00", primary: "138", secondary: "86", unit: "mmHg", context: "morning", flag: "normal" },
    { type: "blood_pressure", at: "2026-06-23T07:30:00", primary: "132", secondary: "82", unit: "mmHg", context: "morning", flag: "normal" },
    // Fasting glucose — running high.
    { type: "blood_glucose", at: "2026-06-05T06:50:00", primary: "142", unit: "mg/dL", context: "fasting", flag: "high" },
    { type: "blood_glucose", at: "2026-06-12T06:45:00", primary: "156", unit: "mg/dL", context: "fasting", flag: "high" },
    { type: "blood_glucose", at: "2026-06-20T06:55:00", primary: "138", unit: "mg/dL", context: "fasting", flag: "high" },
    // Weight — broadly stable.
    { type: "weight", at: "2026-01-10T08:00:00", primary: "72.5", unit: "kg", context: "morning", flag: "normal" },
    { type: "weight", at: "2026-06-15T08:00:00", primary: "71.0", unit: "kg", context: "morning", flag: "normal" },
    // Heart rate.
    { type: "heart_rate", at: "2026-06-16T07:40:00", primary: "72", unit: "bpm", context: "morning", flag: "normal" },
  ];
  await db.insert(vitalReadings).values(
    vitals.map((v) => ({
      patientId: STUB_PATIENT_ID,
      readingType: v.type,
      recordedAt: ist(v.at),
      valuePrimary: v.primary,
      valueSecondary: v.secondary ?? null,
      unit: v.unit,
      context: v.context ?? null,
      flag: v.flag ?? null,
    })),
  );

  // ── Reports (uploaded documents) ─────────────────────────────────────────
  await db.insert(reports).values([
    {
      patientId: STUB_PATIENT_ID,
      title: "Endocrinology consultation note — June 2026",
      reportType: "doctor_letter",
      reportDate: "2026-06-15",
      linkedVisitId: visEndoJun,
      linkedDoctorId: drSrinivas,
      content:
        "Mr. Mavayya reviewed for type 2 diabetes. HbA1c 8.1%, up from 7.6%. Glimepiride increased to 2 mg daily, metformin continued at 1 g twice daily. Diet reinforced. Retinal and foot screening to be arranged. Recheck HbA1c in 3 months.",
      status: "ready",
    },
    {
      patientId: STUB_PATIENT_ID,
      title: "Cardiology prescription — May 2026",
      reportType: "prescription",
      reportDate: "2026-05-08",
      linkedVisitId: visCardioMay,
      linkedDoctorId: drKavita,
      content:
        "Telmisartan 40 mg once daily (increased from 20 mg). Continue atorvastatin 20 mg at night and aspirin 75 mg daily. Repeat home BP log and lipid panel.",
      status: "ready",
    },
  ]);

  // ── Journal entries ──────────────────────────────────────────────────────
  await db.insert(journalEntries).values([
    {
      patientId: STUB_PATIENT_ID,
      entryDate: "2026-06-15",
      title: "Endo visit — sugar up again",
      content:
        "Spoke to Nanna after the endocrinology appointment. His HbA1c is up to 8.1, so Dr. Rao bumped the glimepiride to 2 mg. He sounded a bit down about it. Need to gently keep an eye on the rice at dinner. Also — no eye or foot check done this year, the doctor wants those arranged.",
      mood: "concerned",
      linkedEntities: [
        { type: "condition", id: cDiabetes },
        { type: "med", id: mGlimepiride },
      ],
    },
    {
      patientId: STUB_PATIENT_ID,
      entryDate: "2026-06-04",
      title: "Dizziness in the mornings",
      content:
        "Amma mentioned Nanna has felt lightheaded a few mornings when getting out of bed, ever since the BP medicine was increased. Nothing dramatic but worth mentioning to the doctor. Told him to stand up slowly.",
      mood: "neutral",
      linkedEntities: [{ type: "symptom", id: stDizzy }],
    },
  ]);

  // ── Summary ──────────────────────────────────────────────────────────────
  const [row] = await db
    .select({ id: patients.id, name: patients.name })
    .from(patients)
    .where(sql`${patients.id} = ${STUB_PATIENT_ID}`);

  console.log(`seeded: ${row?.id} (${row?.name})`);
  console.log("  5 doctors · 6 conditions (+4 changes) · 10 medications (+5 changes, incl. 1 paused/1 discontinued)");
  console.log("  2 allergies (+1 change) · 1 lifestyle profile · 3 family history");
  console.log("  7 visits (incl. 1 scheduled, 1 cancelled) · 3 lab reports (19 results, 1 critical) · 11 vitals");
  console.log("  3 symptom types (7 episodes, 1 linked to a visit) · 2 reports · 2 journal entries");
  console.log("  0 insights (E5 generator is the only writer — feed fills as the vault changes)");

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
