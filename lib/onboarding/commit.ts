import "server-only";

import {
  bloodType,
  familyHistoryRelation,
  journalMood,
  lifestyleAlcoholUse,
  lifestyleExerciseIntensity,
  lifestyleStressLevel,
  lifestyleTobaccoUse,
  sex,
} from "@/db/schema";
import {
  familyHistoryQueries,
  journalQueries,
  lifestyleQueries,
  patientQueries,
} from "@/db/queries";
import type { PatientUpdate } from "@/db/queries/patient";
import { commitCard, type CommitContext } from "@/lib/extraction/commit";
import type { OnboardingEntityEmission } from "@/lib/agents/_shared/schemas";
import {
  commitEntityType,
  type CommitEntityType,
} from "@/lib/schemas/api/extract-commit";

/**
 * Live-transparency writes for the onboarding interview (§5.8:1023) — Phase E
 * item E4. The interview's entity emissions land in the vault AS THEY'RE SAID;
 * the conversational text the user typed is the act of confirmation, and the
 * live-populating panel (inline-editable) replaces the E3 gate. This is the
 * §5.8-sanctioned exception to the extraction confirmation flow, not a bypass
 * of it — upload-path extractions still go through §6.11.
 *
 * The eight extraction entity types reuse the E3 commit engine verbatim
 * (change-log discipline, never-fabricate coercion, domain-error copy) with a
 * null `reportId` — there is no source document. The four onboarding-only
 * types (patient identity, family history, lifestyle, journal) are mapped
 * here with the same posture: unrecognised enum values drop rather than
 * guess, required-but-absent fields refuse rather than invent.
 */

export interface OnboardingWriteContext {
  patientId: string;
  userId: string;
  timezone: string;
  today: string;
  nowIso: string;
}

export interface OnboardingWriteResult {
  ok: boolean;
  type: string;
  entityId?: string;
  // Short display label for the live panel's arrival announcement/highlight.
  label?: string;
  // Voice-compliant (§7.1) when surfaced; today it's logged, not rendered.
  error?: string;
}

type Data = Record<string, unknown>;

function str(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function enumMember<T extends string>(
  v: unknown,
  values: readonly T[],
): T | undefined {
  return typeof v === "string" && (values as readonly string[]).includes(v)
    ? (v as T)
    : undefined;
}

function dateOnly(v: unknown): string | undefined {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
}

function intOrUndefined(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  const s = str(v);
  if (!s) return undefined;
  const n = Number.parseInt(s, 10);
  return Number.isNaN(n) ? undefined : n;
}

function numericStr(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  const s = str(v);
  return s && /^-?\d+(\.\d+)?$/.test(s) ? s : undefined;
}

function stringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const items = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return items.length > 0 ? items : undefined;
}

const COMMIT_TYPES = new Set<string>(commitEntityType.options);

// ---- onboarding-only mappers ------------------------------------------------

async function applyPatientIdentity(
  ctx: OnboardingWriteContext,
  data: Data,
): Promise<OnboardingWriteResult> {
  const values: PatientUpdate = {};
  const name = str(data.name);
  if (name) values.name = name;
  const preferredName = str(data.preferred_name);
  if (preferredName) values.preferredName = preferredName;
  const dob = dateOnly(data.date_of_birth);
  if (dob) values.dateOfBirth = dob;
  const sexValue = enumMember(data.sex, sex.enumValues);
  if (sexValue) values.sex = sexValue;
  const blood = enumMember(data.blood_type, bloodType.enumValues);
  if (blood) values.bloodType = blood;
  const height = numericStr(data.height_cm);
  if (height) values.heightCm = height;
  const weight = numericStr(data.current_weight_kg);
  if (weight) values.currentWeightKg = weight;
  const city = str(data.city);
  if (city) values.city = city;
  const country = str(data.country);
  if (country) values.country = country;

  if (Object.keys(values).length === 0) {
    return { ok: false, type: "patient", error: "no recognisable identity fields" };
  }
  const updated = await patientQueries.update(ctx.patientId, values);
  if (!updated) {
    return { ok: false, type: "patient", error: "patient row not found" };
  }
  return { ok: true, type: "patient", entityId: updated.id, label: updated.name };
}

// Shared field coercion for family-history create + update — only fields the
// user stated make it through.
function familyHistoryValues(data: Data) {
  const values: Parameters<typeof familyHistoryQueries.update>[2] = {};
  const statedRelation = str(data.relation);
  if (statedRelation) {
    const relation =
      enumMember(data.relation, familyHistoryRelation.enumValues) ?? "other";
    values.relation = relation;
    if (relation === "other" && !str(data.relation_specific)) {
      values.relationSpecific = statedRelation;
    }
  }
  const relationSpecific = str(data.relation_specific);
  if (relationSpecific) values.relationSpecific = relationSpecific;
  const conditionName = str(data.condition_name);
  if (conditionName) values.conditionName = conditionName;
  const ageOfOnset = intOrUndefined(data.age_of_onset);
  if (ageOfOnset !== undefined) values.ageOfOnset = ageOfOnset;
  const outcome = str(data.outcome);
  if (outcome) values.outcome = outcome;
  const notes = str(data.notes);
  if (notes) values.notes = notes;
  return values;
}

async function updateFamilyHistory(
  ctx: OnboardingWriteContext,
  id: string,
  data: Data,
): Promise<OnboardingWriteResult> {
  const values = familyHistoryValues(data);
  if (Object.keys(values).length === 0) {
    return { ok: false, type: "family_history", error: "no recognisable fields" };
  }
  const row = await familyHistoryQueries.update(ctx.patientId, id, values);
  if (!row) {
    return { ok: false, type: "family_history", error: "entry not found" };
  }
  return {
    ok: true,
    type: "family_history",
    entityId: row.id,
    label: row.conditionName,
  };
}

async function createFamilyHistory(
  ctx: OnboardingWriteContext,
  data: Data,
): Promise<OnboardingWriteResult> {
  const values = familyHistoryValues(data);
  if (!values.conditionName) {
    return {
      ok: false,
      type: "family_history",
      error: "family history entry needs a condition name",
    };
  }
  const row = await familyHistoryQueries.create({
    patientId: ctx.patientId,
    relation: values.relation ?? "other",
    relationSpecific: values.relationSpecific ?? null,
    conditionName: values.conditionName,
    ageOfOnset: values.ageOfOnset ?? null,
    outcome: values.outcome ?? null,
    notes: values.notes ?? null,
  });
  return {
    ok: true,
    type: "family_history",
    entityId: row.id,
    label: values.conditionName,
  };
}

async function applyLifestyle(
  ctx: OnboardingWriteContext,
  data: Data,
): Promise<OnboardingWriteResult> {
  const values: Parameters<typeof lifestyleQueries.update>[1] = {};
  const dietPattern = str(data.diet_pattern);
  if (dietPattern) values.dietPattern = dietPattern;
  const dietRestrictions = stringArray(data.diet_restrictions);
  if (dietRestrictions) values.dietRestrictions = dietRestrictions;
  const exercisePattern = str(data.exercise_pattern);
  if (exercisePattern) values.exercisePattern = exercisePattern;
  const exerciseIntensity = enumMember(
    data.exercise_intensity,
    lifestyleExerciseIntensity.enumValues,
  );
  if (exerciseIntensity) values.exerciseIntensity = exerciseIntensity;
  const sleepPattern = str(data.sleep_pattern);
  if (sleepPattern) values.sleepPattern = sleepPattern;
  const stressLevel = enumMember(data.stress_level, lifestyleStressLevel.enumValues);
  if (stressLevel) values.stressLevel = stressLevel;
  const stressContext = str(data.stress_context);
  if (stressContext) values.stressContext = stressContext;
  const tobaccoUse = enumMember(data.tobacco_use, lifestyleTobaccoUse.enumValues);
  if (tobaccoUse) values.tobaccoUse = tobaccoUse;
  const alcoholUse = enumMember(data.alcohol_use, lifestyleAlcoholUse.enumValues);
  if (alcoholUse) values.alcoholUse = alcoholUse;
  const notes = str(data.notes);
  if (notes) values.notes = notes;

  if (Object.keys(values).length === 0) {
    return { ok: false, type: "lifestyle", error: "no recognisable lifestyle fields" };
  }
  try {
    const row = await lifestyleQueries.update(ctx.patientId, values);
    return { ok: true, type: "lifestyle", entityId: row.id, label: "Lifestyle" };
  } catch (err) {
    // A populated trend field must change via the change log (§4) — during
    // onboarding that means the field was already set (earlier turn or manual
    // entry); skip rather than overwrite history.
    if (err instanceof Error && err.name === "LifestyleDomainError") {
      return { ok: false, type: "lifestyle", error: err.message };
    }
    throw err;
  }
}

async function updateJournalEntry(
  ctx: OnboardingWriteContext,
  id: string,
  data: Data,
): Promise<OnboardingWriteResult> {
  const values: Parameters<typeof journalQueries.update>[2] = {};
  const title = str(data.title);
  if (title) values.title = title;
  const content = str(data.content);
  if (content) values.content = content;
  const entryDate = dateOnly(data.entry_date);
  if (entryDate) values.entryDate = entryDate;
  const mood = enumMember(data.mood, journalMood.enumValues);
  if (mood) values.mood = mood;
  if (Object.keys(values).length === 0) {
    return { ok: false, type: "journal_entry", error: "no recognisable fields" };
  }
  const row = await journalQueries.update(ctx.patientId, id, values);
  if (!row) {
    return { ok: false, type: "journal_entry", error: "entry not found" };
  }
  return {
    ok: true,
    type: "journal_entry",
    entityId: row.id,
    label: row.title ?? "Journal entry",
  };
}

async function createJournalEntry(
  ctx: OnboardingWriteContext,
  data: Data,
): Promise<OnboardingWriteResult> {
  const content = str(data.content);
  if (!content) {
    return { ok: false, type: "journal_entry", error: "journal entry needs content" };
  }
  const row = await journalQueries.create({
    patientId: ctx.patientId,
    entryDate: dateOnly(data.entry_date) ?? ctx.today,
    title: str(data.title) ?? null,
    content,
    mood: enumMember(data.mood, journalMood.enumValues) ?? null,
    recordedBy: ctx.userId,
  });
  return {
    ok: true,
    type: "journal_entry",
    entityId: row.id,
    label: row.title ?? "Journal entry",
  };
}

// Display label for the live panel, pulled from the emission's own data (the
// committed row isn't re-read here).
function labelFor(type: CommitEntityType, data: Data): string | undefined {
  switch (type) {
    case "medication":
    case "condition":
    case "doctor":
      return str(data.name);
    case "allergy":
      return str(data.substance);
    case "lab_report":
      return str(data.title) ?? "Lab report";
    case "vital_reading":
      return str(data.type) ?? "Vital reading";
    case "visit":
      return str(data.reason) ?? "Visit";
    case "symptom_episode":
      return str(data.symptom);
  }
}

/**
 * Routes one validated entity emission to its write path. Returns a per-
 * emission result; unexpected failures throw for the route to log. A refused
 * write (`ok: false`) never interrupts the interview — the card simply doesn't
 * appear, and the user can restate or add it manually.
 */
export async function applyOnboardingEmission(
  ctx: OnboardingWriteContext,
  emission: OnboardingEntityEmission,
): Promise<OnboardingWriteResult> {
  const { type, data } = emission;

  if (COMMIT_TYPES.has(type)) {
    const commitType = type as CommitEntityType;
    const commitCtx: CommitContext = {
      patientId: ctx.patientId,
      userId: ctx.userId,
      timezone: ctx.timezone,
      reportId: null,
      today: ctx.today,
      nowIso: ctx.nowIso,
    };
    const result = await commitCard(commitCtx, {
      targetEntityType: commitType,
      mode: emission.intent === "update" ? "update" : "create",
      matchedEntityId: emission.matched_entity_id ?? null,
      data,
    });
    return {
      ok: result.ok,
      type,
      entityId: result.entityId,
      label: labelFor(commitType, data),
      error: result.error,
    };
  }

  // Patient + lifestyle are singleton upserts, so create-vs-update is moot;
  // family history and journal honor an update intent against a matched row —
  // routing an agent correction into the create path would duplicate the entry.
  const isUpdate = emission.intent === "update" && !!emission.matched_entity_id;

  switch (type) {
    case "patient":
      return applyPatientIdentity(ctx, data);
    case "family_history":
      return isUpdate
        ? updateFamilyHistory(ctx, emission.matched_entity_id as string, data)
        : createFamilyHistory(ctx, data);
    case "lifestyle":
      return applyLifestyle(ctx, data);
    case "journal_entry":
      return isUpdate
        ? updateJournalEntry(ctx, emission.matched_entity_id as string, data)
        : createJournalEntry(ctx, data);
    default:
      return { ok: false, type, error: "unknown emission type" };
  }
}
