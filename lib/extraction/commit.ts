import "server-only";

import {
  allergyCategory,
  allergySeverity,
  allergyStatus,
  conditionCategory,
  conditionSeverity,
  conditionStatus,
  labResultFlag,
  medicationCategory,
  medicationForm,
  medicationStatus,
  symptomBodyArea,
  symptomEpisodeSeverity,
  vitalReadingType,
  visitType,
} from "@/db/schema";
import {
  allergyChangeQueries,
  allergyQueries,
  conditionChangeQueries,
  conditionQueries,
  doctorChangeQueries,
  doctorQueries,
  labReportQueries,
  labResultQueries,
  medicationChangeQueries,
  medicationQueries,
  symptomEpisodeQueries,
  symptomTypeQueries,
  visitQueries,
  vitalQueries,
} from "@/db/queries";
import type { NewLabResultInput } from "@/db/queries/lab";
import type { CommitCardInput, CommitEntityType } from "@/lib/schemas/api/extract-commit";

/**
 * Server-side commit for the E3 extraction confirmation surface (§6.11 / §5.4).
 *
 * This is the ONLY place extraction output becomes vault rows. Extraction never
 * auto-writes (§5.4:752 tripwire); commit runs only from the human-reviewed
 * confirmation screen, per card. Each committed entity carries `source_report_id`
 * back to the originating Report (§5.4:796 "source link persists on the entity
 * page"), for the seven entity types whose schema carries that column — doctors
 * and allergies don't (Phase A groundwork), so those commit without a backlink.
 *
 * Two design rules shape the mapping:
 *  - Never fabricate (§5.4:794). A field the agent didn't extract stays null; an
 *    enum value we can't recognise is dropped, not guessed. Required-but-absent
 *    clinical fields (a medication with no dose) block the card with a plain-
 *    language ask rather than inventing a value.
 *  - Entity-type write model (§5.4:791). Event entities (lab / vital / visit /
 *    symptom) are ALWAYS create-new; only state entities (medication / condition
 *    / doctor / allergy) can be an `update`, applied through their change-log +
 *    PATCH helpers so the change-log tripwire (append a *_changes row; update
 *    current_* in place) is never bypassed.
 */

export interface CommitContext {
  patientId: string;
  userId: string;
  // Patient's IANA timezone — needed by medicationQueries.discontinue to stamp
  // discontinuedOn in the patient's local day (§9.6).
  timezone: string;
  // The originating Report — becomes `source_report_id` on committed entities.
  reportId: string;
  // Patient-local `YYYY-MM-DD`, the fallback for a required date the agent left
  // out (a lab/visit with no date on the page). ISO datetime fallback for the
  // timestamptz event clocks (vital / symptom).
  today: string;
  nowIso: string;
}

export interface CommitCardResult {
  ok: boolean;
  entityType: CommitEntityType;
  entityId?: string;
  // Voice-compliant, user-facing (§7.1) — rendered on the card when a commit is
  // blocked. Speaks as "I", never "As an AI", never blames the user.
  error?: string;
}

/**
 * A per-card commit refusal the user can act on inline — a missing required
 * field, an unmatchable reference. Distinct from an unexpected throw (which the
 * endpoint maps to a generic server error and logs). The message is shown
 * verbatim on the card, so it follows brand voice.
 */
class CommitBlocked extends Error {}

// A state-machine violation raised by the query layer (e.g. a dose change routed
// at an already-discontinued medication) surfaces as a `*DomainError` whose
// `message` is a machine kind, not user copy. Left unconverted it bubbles out of
// commitCard → the endpoint 500s → the sequential batch aborts AFTER earlier
// cards already wrote, so a retry re-commits them (duplicate writes). Converting
// it to a per-card block here keeps one bad card from taking down the batch.
function isDomainError(err: unknown): err is Error {
  return err instanceof Error && err.name.endsWith("DomainError");
}

// Voice-compliant copy (§7.1) for the domain-error kinds a commit can hit; the
// `message` on these errors equals the kind (`super(kind)`). Anything unmapped
// falls back to the generic line below.
const DOMAIN_ERROR_COPY: Record<string, string> = {
  medication_discontinued:
    "This medication is already discontinued — it can't take further changes. Open it to edit it directly, or switch this card to “add new.”",
  already_discontinued:
    "This medication is already discontinued — nothing to change here.",
};

// ---- value coercion --------------------------------------------------------
// The agent emits snake_case string fields (§5.4:763). These narrow untyped
// jsonb values to the exact column/enum shapes, dropping anything unrecognised
// rather than coercing blindly.

type Data = Record<string, unknown>;

function str(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function enumMember<T extends string>(
  v: unknown,
  values: readonly T[],
): T | undefined {
  const s = str(v);
  if (s === undefined) return undefined;
  const normalized = s.toLowerCase().replace(/\s+/g, "_");
  return values.find((x) => x === s || x === normalized);
}

function dateOnly(v: unknown): string | undefined {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
}

function numericStr(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  const s = str(v);
  return s && /^-?\d+(\.\d+)?$/.test(s) ? s : undefined;
}

// Coerce the agent's timestamp for a timestamptz event clock. A bare date maps
// to UTC midnight; anything unparseable falls back to "now" rather than
// fabricating a time.
function toDate(v: unknown, fallbackIso: string): Date {
  const s = str(v);
  if (!s) return new Date(fallbackIso);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00Z`);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date(fallbackIso) : d;
}

// "152/95" → { primary: "152", secondary: "95" }; a single number → primary only.
function splitBloodPressure(v: unknown): {
  primary?: string;
  secondary?: string;
} {
  const s = str(v);
  if (s) {
    const m = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (m) return { primary: m[1], secondary: m[2] };
  }
  const single = numericStr(v);
  return single ? { primary: single } : {};
}

// "70-100" / "70 – 100" → {low,high}; "<100" → {high}; ">5" → {low}.
function splitReferenceRange(v: unknown): { low?: string; high?: string } {
  const s = str(v);
  if (!s) return {};
  const range = s.match(/^(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)$/);
  if (range) return { low: range[1], high: range[2] };
  const lt = s.match(/^<\s*(-?\d+(?:\.\d+)?)$/);
  if (lt) return { high: lt[1] };
  const gt = s.match(/^>\s*(-?\d+(?:\.\d+)?)$/);
  if (gt) return { low: gt[1] };
  return {};
}

function joinNotes(...parts: Array<string | undefined>): string | null {
  const kept = parts.filter((p): p is string => !!p && p.trim().length > 0);
  return kept.length > 0 ? kept.join("\n\n") : null;
}

// A required clinical field the agent didn't extract — never invented. Units are
// contextual (not a clinical value), so vitals get a sensible default by type.
const VITAL_DEFAULT_UNIT: Record<string, string> = {
  blood_pressure: "mmHg",
  weight: "kg",
  blood_glucose: "mg/dL",
  temperature: "°C",
  heart_rate: "bpm",
  oxygen_saturation: "%",
  respiratory_rate: "breaths/min",
};

// ---- CREATE per entity type ------------------------------------------------

async function createMedication(
  ctx: CommitContext,
  data: Data,
): Promise<string> {
  const name = str(data.name);
  const dose = str(data.current_dose) ?? str(data.dose);
  const frequency = str(data.current_frequency) ?? str(data.frequency);
  if (!name) throw new CommitBlocked("A medication needs a name — add one, then confirm.");
  if (!dose || !frequency)
    throw new CommitBlocked("A medication needs a dose and a frequency — fill those in, then confirm.");

  const purpose = str(data.purpose);
  const med = await medicationQueries.create({
    patientId: ctx.patientId,
    sourceReportId: ctx.reportId,
    name,
    brandName: str(data.brand_name) ?? null,
    currentDose: dose,
    currentFrequency: frequency,
    // The agent doesn't emit category; default to the dominant case (§4). The
    // free-text `purpose` can't become the UUID condition ref, so it's preserved
    // in notes rather than dropped.
    category: enumMember(data.category, medicationCategory.enumValues) ?? "allopathic",
    form: enumMember(data.form, medicationForm.enumValues) ?? null,
    startedOn: dateOnly(data.started_on) ?? null,
    notes: joinNotes(str(data.notes), purpose ? `Purpose: ${purpose}` : undefined),
  });
  return med.id;
}

async function createCondition(
  ctx: CommitContext,
  data: Data,
): Promise<string> {
  const name = str(data.name);
  if (!name) throw new CommitBlocked("A condition needs a name — add one, then confirm.");
  const row = await conditionQueries.create({
    patientId: ctx.patientId,
    sourceReportId: ctx.reportId,
    name,
    status: enumMember(data.status, conditionStatus.enumValues),
    severity: enumMember(data.severity, conditionSeverity.enumValues) ?? null,
    category: enumMember(data.category, conditionCategory.enumValues) ?? null,
    // Optional diagnosis date the user can add via the §6.11 enrichment chips
    // (diagnosed_by / managing_doctor stay deferred — they need the doctor picker).
    diagnosedOn: dateOnly(data.diagnosed_on) ?? null,
    notes: str(data.notes) ?? null,
  });
  return row.id;
}

async function createDoctor(ctx: CommitContext, data: Data): Promise<string> {
  const name = str(data.name);
  const specialty = str(data.specialty);
  if (!name) throw new CommitBlocked("This doctor needs a name — add one, then confirm.");
  if (!specialty)
    throw new CommitBlocked("This doctor needs a specialty — add it, then confirm.");
  // No source_report_id / recorded_by column on doctors (Phase A) — commits
  // without a backlink.
  const row = await doctorQueries.create({
    patientId: ctx.patientId,
    name,
    specialty,
    notes: str(data.notes) ?? null,
  });
  return row.id;
}

async function createAllergy(ctx: CommitContext, data: Data): Promise<string> {
  const substance = str(data.substance);
  if (!substance)
    throw new CommitBlocked("An allergy needs a substance — add it, then confirm.");
  // No source_report_id / recorded_by column on allergies (Phase A). `category`
  // is NOT NULL with no default (§4:259) and the agent doesn't emit it — default
  // to "other".
  const row = await allergyQueries.create({
    patientId: ctx.patientId,
    substance,
    category: enumMember(data.category, allergyCategory.enumValues) ?? "other",
    reaction: str(data.reaction) ?? null,
    severity: enumMember(data.severity, allergySeverity.enumValues),
    status: enumMember(data.status, allergyStatus.enumValues),
    notes: str(data.notes) ?? null,
  });
  return row.id;
}

// Parse the agent's `results[]` into insert-ready marker rows — shared by the
// create and amend (append) paths. Rows with no marker name are dropped.
function parseLabResults(data: Data): NewLabResultInput[] {
  const rawResults = Array.isArray(data.results) ? data.results : [];
  const results: NewLabResultInput[] = [];
  for (const r of rawResults) {
    if (typeof r !== "object" || r === null) continue;
    const rr = r as Data;
    const marker = str(rr.marker);
    if (!marker) continue;
    const numeric = numericStr(rr.value);
    const ref = splitReferenceRange(rr.reference_range);
    results.push({
      marker,
      value: numeric ?? null,
      valueText: numeric ? null : (str(rr.value) ?? null),
      unit: str(rr.unit) ?? null,
      referenceLow: ref.low ?? null,
      referenceHigh: ref.high ?? null,
      flag: enumMember(rr.flag, labResultFlag.enumValues),
    });
  }
  return results;
}

async function createLabReport(
  ctx: CommitContext,
  data: Data,
): Promise<string> {
  const results = parseLabResults(data);

  const orderingDoctor = str(data.ordering_doctor);
  const report = await labReportQueries.create(
    {
      patientId: ctx.patientId,
      sourceReportId: ctx.reportId,
      reportDate: dateOnly(data.report_date) ?? ctx.today,
      reportType: str(data.report_type) ?? null,
      // The agent labels the panel `title`; the lab entity's stable name is
      // `labName`. The free-text ordering doctor can't be the UUID `orderedBy`,
      // so it's kept in notes.
      labName: str(data.lab_name) ?? str(data.title) ?? null,
      notes: joinNotes(
        str(data.notes),
        orderingDoctor ? `Ordering doctor: ${orderingDoctor}` : undefined,
      ),
    },
    results,
  );
  return report.id;
}

async function createVitalReading(
  ctx: CommitContext,
  data: Data,
): Promise<string> {
  const readingType = enumMember(data.type, vitalReadingType.enumValues) ?? "other";
  const { primary, secondary } =
    readingType === "blood_pressure"
      ? splitBloodPressure(data.value)
      : { primary: numericStr(data.value), secondary: undefined };
  if (!primary)
    throw new CommitBlocked("This reading needs a number — add the value, then confirm.");

  const unit = str(data.unit) ?? VITAL_DEFAULT_UNIT[readingType];
  if (!unit)
    throw new CommitBlocked("This reading needs a unit — add it, then confirm.");

  const row = await vitalQueries.create({
    patientId: ctx.patientId,
    recordedBy: ctx.userId,
    sourceReportId: ctx.reportId,
    readingType,
    recordedAt: toDate(data.measured_at, ctx.nowIso),
    valuePrimary: primary,
    valueSecondary: secondary ?? null,
    unit,
    notes: str(data.notes) ?? null,
  });
  return row.id;
}

async function createVisit(ctx: CommitContext, data: Data): Promise<string> {
  // A visit's doctor is NOT NULL (§4:346) and the agent gives only a name. We
  // match an existing in-scope doctor rather than fabricate one — an unmatched
  // name blocks the card with a plain ask (add the doctor first).
  const doctorName = str(data.doctor);
  if (!doctorName)
    throw new CommitBlocked("A visit needs its doctor — add the doctor's name, then confirm.");
  const doctors = await doctorQueries.forPatient(ctx.patientId);
  const match = doctors.find(
    (d) => d.name.toLowerCase() === doctorName.toLowerCase(),
  );
  if (!match)
    throw new CommitBlocked(
      `I couldn't match a doctor named "${doctorName}". Add them under Doctors first, then confirm this visit.`,
    );

  const row = await visitQueries.create({
    patientId: ctx.patientId,
    sourceReportId: ctx.reportId,
    doctorId: match.id,
    visitDate: dateOnly(data.visit_date) ?? ctx.today,
    visitType: enumMember(data.visit_type, visitType.enumValues),
    chiefComplaint: str(data.reason) ?? null,
    summary: str(data.summary) ?? null,
    notes: str(data.notes) ?? null,
  });
  return row.id;
}

async function createSymptomEpisode(
  ctx: CommitContext,
  data: Data,
): Promise<string> {
  const symptomName = str(data.symptom);
  if (!symptomName)
    throw new CommitBlocked("A symptom needs a name — add one, then confirm.");

  // Reuse an existing type of the same name so episodes group correctly; the
  // agent gives a name, not a type id, and matched_entity_id would ambiguously
  // reference either the type or a prior episode.
  const types = await symptomTypeQueries.forPatient(ctx.patientId);
  const existing = types.find(
    (t) => t.name.toLowerCase() === symptomName.toLowerCase(),
  );

  const { episode } = await symptomEpisodeQueries.create(
    ctx.patientId,
    existing
      ? { kind: "existing", symptomTypeId: existing.id }
      : {
          kind: "new",
          name: symptomName,
          // The agent classifies body_area from the stated symptom (a new type
          // needs it; body_area lives on the type, not the episode). An existing
          // type keeps whatever area it already carries.
          bodyArea: enumMember(data.body_area, symptomBodyArea.enumValues),
        },
    {
      startedAt: toDate(data.started_at, ctx.nowIso),
      severity: enumMember(data.severity, symptomEpisodeSeverity.enumValues),
      notes: str(data.notes) ?? null,
      sourceReportId: ctx.reportId,
      recordedBy: ctx.userId,
    },
  );
  return episode.id;
}

// ---- UPDATE (state entities only) ------------------------------------------
// Applied through the change-log + PATCH helpers so the change-log tripwire is
// respected: a differing change-logged field appends a *_changes row and moves
// current_* in place; plain fields PATCH. A card whose data matches the record
// exactly is blocked (nothing to apply) rather than writing a no-op.

const UPDATE_REASON = "Applied from an extracted document.";

async function updateMedication(
  ctx: CommitContext,
  id: string,
  data: Data,
): Promise<string> {
  const current = await medicationQueries.getById(ctx.patientId, id);
  if (!current)
    throw new CommitBlocked("I couldn't find that medication anymore — switch this card to “add new.”");

  // Status transitions first. Discontinuation is terminal — route it to the
  // discontinue path (appends a status change + stamps discontinuedOn) and stop;
  // a discontinued medication can't take further change-log rows. (The agent
  // emits status "discontinued" for "no longer taking", "paused" for a hold.)
  const status = enumMember(data.status, medicationStatus.enumValues);
  if (status === "discontinued") {
    if (current.status === "discontinued") {
      throw new CommitBlocked(`${current.name} is already marked discontinued — nothing to change.`);
    }
    await medicationQueries.discontinue(ctx.patientId, id, {
      reason: str(data.notes) ?? "Logged as no longer taken.",
      timezone: ctx.timezone,
    });
    return id;
  }

  let applied = false;

  if (status === "paused" && current.status === "active") {
    await medicationChangeQueries.create(ctx.patientId, id, {
      field: "status",
      newValue: "paused",
      recordedBy: ctx.userId,
      reason: str(data.notes) ?? UPDATE_REASON,
    });
    applied = true;
  }

  const dose = str(data.current_dose) ?? str(data.dose);
  const frequency = str(data.current_frequency) ?? str(data.frequency);
  if (dose && dose !== current.currentDose) {
    await medicationChangeQueries.create(ctx.patientId, id, {
      field: "dose",
      newValue: dose,
      recordedBy: ctx.userId,
      reason: UPDATE_REASON,
    });
    applied = true;
  }
  if (frequency && frequency !== current.currentFrequency) {
    await medicationChangeQueries.create(ctx.patientId, id, {
      field: "frequency",
      newValue: frequency,
      recordedBy: ctx.userId,
      reason: UPDATE_REASON,
    });
    applied = true;
  }
  // brand / notes are plain PATCH fields on medications (not change-logged).
  const patch: { brandName?: string; notes?: string } = {};
  const brand = str(data.brand_name);
  if (brand && brand !== current.brandName) patch.brandName = brand;
  const notes = str(data.notes);
  if (notes && notes !== current.notes)
    patch.notes = joinNotes(current.notes ?? undefined, notes) ?? notes;
  if (Object.keys(patch).length > 0) {
    await medicationQueries.update(ctx.patientId, id, patch);
    applied = true;
  }

  if (!applied)
    throw new CommitBlocked("Nothing here differs from the medication on file — discard this card, or switch it to “add new.”");
  return id;
}

async function updateCondition(
  ctx: CommitContext,
  id: string,
  data: Data,
): Promise<string> {
  const current = await conditionQueries.getById(ctx.patientId, id);
  if (!current)
    throw new CommitBlocked("I couldn't find that condition anymore — switch this card to “add new.”");

  let applied = false;
  const status = enumMember(data.status, conditionStatus.enumValues);
  if (status && status !== current.status) {
    await conditionChangeQueries.create(ctx.patientId, id, {
      field: "status",
      newValue: status,
      recordedBy: ctx.userId,
      reason: UPDATE_REASON,
    });
    applied = true;
  }
  const severity = enumMember(data.severity, conditionSeverity.enumValues);
  if (severity && severity !== current.severity) {
    await conditionChangeQueries.create(ctx.patientId, id, {
      field: "severity",
      newValue: severity,
      recordedBy: ctx.userId,
      reason: UPDATE_REASON,
    });
    applied = true;
  }
  const notes = str(data.notes);
  if (notes && notes !== current.notes) {
    await conditionQueries.update(ctx.patientId, id, {
      notes: joinNotes(current.notes ?? undefined, notes) ?? notes,
    });
    applied = true;
  }

  if (!applied)
    throw new CommitBlocked("Nothing here differs from the condition on file — discard this card, or switch it to “add new.”");
  return id;
}

async function updateAllergy(
  ctx: CommitContext,
  id: string,
  data: Data,
): Promise<string> {
  const current = await allergyQueries.getById(ctx.patientId, id);
  if (!current)
    throw new CommitBlocked("I couldn't find that allergy anymore — switch this card to “add new.”");

  let applied = false;
  const status = enumMember(data.status, allergyStatus.enumValues);
  if (status && status !== current.status) {
    await allergyChangeQueries.create(ctx.patientId, id, {
      field: "status",
      newValue: status,
      recordedBy: ctx.userId,
      reason: UPDATE_REASON,
    });
    applied = true;
  }
  const severity = enumMember(data.severity, allergySeverity.enumValues);
  if (severity && severity !== current.severity) {
    await allergyChangeQueries.create(ctx.patientId, id, {
      field: "severity",
      newValue: severity,
      recordedBy: ctx.userId,
      reason: UPDATE_REASON,
    });
    applied = true;
  }
  const reactionOrNotes = joinNotes(
    current.notes ?? undefined,
    str(data.reaction) && str(data.reaction) !== current.reaction
      ? `Reaction: ${str(data.reaction)}`
      : undefined,
    str(data.notes),
  );
  if (reactionOrNotes && reactionOrNotes !== current.notes) {
    await allergyQueries.update(ctx.patientId, id, { notes: reactionOrNotes });
    applied = true;
  }

  if (!applied)
    throw new CommitBlocked("Nothing here differs from the allergy on file — discard this card, or switch it to “add new.”");
  return id;
}

async function updateDoctor(
  ctx: CommitContext,
  id: string,
  data: Data,
): Promise<string> {
  const current = await doctorQueries.getById(ctx.patientId, id);
  if (!current)
    throw new CommitBlocked("I couldn't find that doctor anymore — switch this card to “add new.”");

  let applied = false;
  const specialty = str(data.specialty);
  if (specialty && specialty !== current.specialty) {
    await doctorChangeQueries.create(ctx.patientId, id, {
      field: "specialty",
      newValue: specialty,
      recordedBy: ctx.userId,
      reason: UPDATE_REASON,
    });
    applied = true;
  }
  const notes = str(data.notes);
  if (notes && notes !== current.notes) {
    await doctorQueries.update(ctx.patientId, id, {
      notes: joinNotes(current.notes ?? undefined, notes) ?? notes,
    });
    applied = true;
  }

  if (!applied)
    throw new CommitBlocked("Nothing here differs from the doctor on file — discard this card, or switch it to “add new.”");
  return id;
}

// ---- AMEND (event entities) ------------------------------------------------
// A lab_report / visit / symptom_episode is create-new as an event (§5.4:791),
// but a note can ADD to or CORRECT one that already exists — "add creatinine 1.7
// to the June 15 lab", "the April 3 creatinine was actually 1.5", "add to the
// April 3 visit that he also reported dizziness", "Tuesday's headache was
// severe". Events have no change log, so an amendment overwrites in place (the
// §6.7 Edit / `+ Log a correction` model): a lab appends new markers AND corrects
// existing ones; a visit corrects its fields + appends notes; a symptom corrects
// severity/notes. vital_reading is the deliberate exception — §4:433 keeps
// readings immutable (delete + re-enter), so it stays create-only.

async function updateLabReport(
  ctx: CommitContext,
  id: string,
  data: Data,
): Promise<string> {
  const report = await labReportQueries.getById(ctx.patientId, id);
  if (!report)
    throw new CommitBlocked("I couldn't find that lab report anymore — switch this card to “add new.”");

  const parsed = parseLabResults(data);
  const existing = await labResultQueries.forReport(id);
  const byName = new Map(existing.map((r) => [r.marker.trim().toLowerCase(), r]));
  const toAppend: NewLabResultInput[] = [];
  let corrected = 0;

  for (const r of parsed) {
    const hasValue =
      r.value !== null ||
      (r.valueText !== null && r.valueText !== undefined && r.valueText !== "");
    const match = byName.get(r.marker.trim().toLowerCase());

    if (!match) {
      // Append only a marker that actually carries a value — never an empty row.
      if (hasValue) toAppend.push(r);
      continue;
    }

    // Correct in place, PRESERVING any measured field the note didn't restate
    // (so a value-less unit/flag/range fix still applies, and an existing value
    // is never nulled out) — and only when something actually differs.
    const next = {
      value: r.value ?? match.value,
      valueText: r.value ? null : (r.valueText ?? match.valueText),
      unit: r.unit ?? match.unit,
      referenceLow: r.referenceLow ?? match.referenceLow,
      referenceHigh: r.referenceHigh ?? match.referenceHigh,
      flag: r.flag ?? match.flag,
    };
    const changed =
      next.value !== match.value ||
      next.valueText !== match.valueText ||
      next.unit !== match.unit ||
      next.referenceLow !== match.referenceLow ||
      next.referenceHigh !== match.referenceHigh ||
      next.flag !== match.flag;
    if (changed) {
      await labResultQueries.correctResult(ctx.patientId, id, match.id, next);
      corrected += 1;
    }
  }

  if (toAppend.length > 0)
    await labResultQueries.addResults(ctx.patientId, id, report.reportDate, toAppend);

  if (corrected === 0 && toAppend.length === 0)
    throw new CommitBlocked(
      "Nothing here changes the report — those markers already read this way, or no value was given. Discard this card, or switch it to “add new.”",
    );
  return id;
}

async function updateVisit(
  ctx: CommitContext,
  id: string,
  data: Data,
): Promise<string> {
  const current = await visitQueries.getById(ctx.patientId, id);
  if (!current)
    throw new CommitBlocked("I couldn't find that visit anymore — switch this card to “add new.”");

  // Events have no change log (§6.7 Edit = in-place): correct the structured
  // fields, and APPEND to the running notes rather than overwriting them.
  const patch: {
    visitDate?: string;
    visitType?: (typeof visitType.enumValues)[number];
    chiefComplaint?: string;
    summary?: string;
    doctorId?: string;
    notes?: string;
  } = {};

  const newDate = dateOnly(data.visit_date);
  if (newDate && newDate !== current.visitDate) patch.visitDate = newDate;
  const newType = enumMember(data.visit_type, visitType.enumValues);
  if (newType && newType !== current.visitType) patch.visitType = newType;
  const reason = str(data.reason);
  if (reason && reason !== current.chiefComplaint) patch.chiefComplaint = reason;
  const summary = str(data.summary);
  if (summary && summary !== current.summary) patch.summary = summary;

  // Doctor re-match by name (visits.doctor_id is NOT NULL). Only reassign when a
  // different in-scope doctor is named; an unmatched name blocks the card.
  const doctorName = str(data.doctor);
  if (doctorName) {
    const doctors = await doctorQueries.forPatient(ctx.patientId);
    const match = doctors.find(
      (d) => d.name.toLowerCase() === doctorName.toLowerCase(),
    );
    if (!match)
      throw new CommitBlocked(
        `I couldn't match a doctor named "${doctorName}". Add them under Doctors first, then confirm this change.`,
      );
    if (match.id !== current.doctorId) patch.doctorId = match.id;
  }

  // Append to the running notes (exact-match dedup, like the state entities —
  // `.includes` would false-skip an addition that's a substring of the notes).
  const noteAddition = str(data.notes);
  if (noteAddition && noteAddition !== current.notes)
    patch.notes = joinNotes(current.notes ?? undefined, noteAddition) ?? noteAddition;

  if (Object.keys(patch).length === 0)
    throw new CommitBlocked("Nothing here differs from the visit on file — discard this card, or switch it to “add new.”");

  await visitQueries.update(ctx.patientId, id, patch);
  return id;
}

async function updateSymptomEpisode(
  ctx: CommitContext,
  id: string,
  data: Data,
): Promise<string> {
  const current = await symptomEpisodeQueries.getById(ctx.patientId, id);
  if (!current)
    throw new CommitBlocked("I couldn't find that episode anymore — switch this card to “add new.”");

  // Overwrite severity (a correction); append to notes (§4:513 — episode edits
  // overwrite in place, but a logged note reads as an addition to the record).
  const patch: {
    severity?: (typeof symptomEpisodeSeverity.enumValues)[number];
    notes?: string;
  } = {};
  const severity = enumMember(data.severity, symptomEpisodeSeverity.enumValues);
  if (severity && severity !== current.severity) patch.severity = severity;
  // Exact-match dedup on the note append (see updateVisit).
  const noteAddition = str(data.notes);
  if (noteAddition && noteAddition !== current.notes)
    patch.notes = joinNotes(current.notes ?? undefined, noteAddition) ?? noteAddition;

  if (Object.keys(patch).length === 0)
    throw new CommitBlocked("Nothing here differs from the episode on file — discard this card, or switch it to “add new.”");

  await symptomEpisodeQueries.update(ctx.patientId, id, patch);
  return id;
}

// State entities update through their change-log helpers (§5.4:791).
const STATE_TYPES = new Set<CommitEntityType>([
  "medication",
  "condition",
  "doctor",
  "allergy",
]);

// Event entities that accept an amendment `update` (append/correct in place).
// vital_reading stays create-only — §4:433 keeps readings immutable.
const AMENDABLE_EVENT_TYPES = new Set<CommitEntityType>([
  "lab_report",
  "visit",
  "symptom_episode",
]);

// Types whose `update` card commits as an update rather than a create.
const UPDATABLE_TYPES = new Set<CommitEntityType>([
  ...STATE_TYPES,
  ...AMENDABLE_EVENT_TYPES,
]);

/**
 * Commit one confirmation card to the vault. Returns a per-card result; a
 * blocked commit (missing field, unmatchable ref, no-op update) resolves with
 * `ok: false` + a voice-compliant `error` for the card to show. Unexpected
 * failures throw for the endpoint to log + surface generically.
 */
export async function commitCard(
  ctx: CommitContext,
  card: CommitCardInput,
): Promise<CommitCardResult> {
  const { targetEntityType: type, data } = card;
  const isUpdate =
    card.mode === "update" &&
    UPDATABLE_TYPES.has(type) &&
    card.matchedEntityId !== null;

  try {
    let entityId: string;
    if (isUpdate) {
      const id = card.matchedEntityId as string;
      switch (type) {
        case "medication":
          entityId = await updateMedication(ctx, id, data);
          break;
        case "condition":
          entityId = await updateCondition(ctx, id, data);
          break;
        case "allergy":
          entityId = await updateAllergy(ctx, id, data);
          break;
        case "doctor":
          entityId = await updateDoctor(ctx, id, data);
          break;
        case "lab_report":
          entityId = await updateLabReport(ctx, id, data);
          break;
        case "visit":
          entityId = await updateVisit(ctx, id, data);
          break;
        case "symptom_episode":
          entityId = await updateSymptomEpisode(ctx, id, data);
          break;
        default:
          // Unreachable: isUpdate is gated on UPDATABLE_TYPES.
          throw new CommitBlocked("This type can't be updated — switch to “add new.”");
      }
    } else {
      switch (type) {
        case "medication":
          entityId = await createMedication(ctx, data);
          break;
        case "condition":
          entityId = await createCondition(ctx, data);
          break;
        case "doctor":
          entityId = await createDoctor(ctx, data);
          break;
        case "allergy":
          entityId = await createAllergy(ctx, data);
          break;
        case "lab_report":
          entityId = await createLabReport(ctx, data);
          break;
        case "vital_reading":
          entityId = await createVitalReading(ctx, data);
          break;
        case "visit":
          entityId = await createVisit(ctx, data);
          break;
        case "symptom_episode":
          entityId = await createSymptomEpisode(ctx, data);
          break;
      }
    }
    return { ok: true, entityType: type, entityId };
  } catch (err) {
    if (err instanceof CommitBlocked) {
      return { ok: false, entityType: type, error: err.message };
    }
    if (isDomainError(err)) {
      return {
        ok: false,
        entityType: type,
        error:
          DOMAIN_ERROR_COPY[err.message] ??
          "I couldn't apply this to the record as it stands — open the entity to make this change directly.",
      };
    }
    throw err;
  }
}

// One human line per committed card, for the "Logged ✓" chat acknowledgement
// (§6.2:1197) written back to the conversation on finalize. Brand voice (§7.1):
// plain, direct, the AI speaking as "I".
function phraseForCard(card: CommitCardInput): string {
  const s = (key: string) => str(card.data[key]);
  const updating = card.mode === "update";
  switch (card.targetEntityType) {
    case "medication": {
      const name = s("name") ?? "medication";
      const dose = s("current_dose") ?? s("dose");
      const freq = s("current_frequency") ?? s("frequency");
      if (updating) {
        const status = enumMember(card.data.status, medicationStatus.enumValues);
        if (status === "discontinued") return `Discontinued ${name}`;
        if (status === "paused") return `Paused ${name}`;
        const detail = [dose, freq].filter(Boolean).join(", ");
        return `Updated ${name}${detail ? ` — now ${detail}` : ""}`;
      }
      return `Added ${name}${dose ? ` ${dose}` : ""}`;
    }
    case "condition":
      return `${updating ? "Updated" : "Added"} condition${s("name") ? `: ${s("name")}` : ""}`;
    case "doctor":
      return `${updating ? "Updated" : "Added"} doctor${s("name") ? `: ${s("name")}` : ""}`;
    case "allergy":
      return `${updating ? "Updated" : "Added"} allergy${s("substance") ? `: ${s("substance")}` : ""}`;
    case "lab_report": {
      // A create says "new lab report"; an amend (§6.7) appended markers to an
      // existing one, so say "Added … to the lab report". Name the markers so
      // it's specific either way.
      const date = s("report_date");
      const rawResults = Array.isArray(card.data.results) ? card.data.results : [];
      const markers = rawResults
        .map((r) => {
          if (typeof r !== "object" || r === null) return null;
          const rr = r as Data;
          const marker = str(rr.marker);
          if (!marker) return null;
          return [marker, str(rr.value), str(rr.unit)].filter(Boolean).join(" ");
        })
        .filter((m): m is string => m !== null);
      if (updating) {
        const what = markers.length > 0 ? markers.join(", ") : "a result";
        return `Updated a lab report — ${what}`;
      }
      const label = s("title") ?? s("lab_name");
      const head = `Added a new lab report${date ? ` (${date})` : ""}`;
      const tail = markers.length > 0 ? ` — ${markers.join(", ")}` : label ? `: ${label}` : "";
      return `${head}${tail}`;
    }
    case "vital_reading": {
      const kind = (s("type") ?? "vital").replace(/_/g, " ");
      const value = s("value");
      return `Logged ${kind}${value ? ` ${value}` : ""}`;
    }
    case "visit":
      if (updating)
        return `Updated a visit${s("visit_date") ? ` (${s("visit_date")})` : ""}`;
      return `Logged a visit${s("visit_date") ? ` (${s("visit_date")})` : ""}`;
    case "symptom_episode":
      if (updating)
        return `Updated symptom${s("symptom") ? `: ${s("symptom")}` : ""}`;
      return `Logged symptom${s("symptom") ? `: ${s("symptom")}` : ""}`;
  }
}

/**
 * The assistant acknowledgement written back to the chat conversation once a log
 * commits (§6.2:1197) — so returning to the chat shows that something happened,
 * not just the user's own message. Summarizes only the cards committed in this
 * request (the whole batch for "Confirm all"; the last card for per-card
 * confirms — an accepted partial). Empty string when nothing committed.
 */
export function summarizeCommit(
  cards: CommitCardInput[],
  results: CommitCardResult[],
): string {
  const lines = cards
    .filter((_, i) => results[i]?.ok)
    .map((card) => `- ${phraseForCard(card)}`);
  if (lines.length === 0) return "";
  return `Done — I've logged that to the record:\n\n${lines.join("\n")}`;
}

/**
 * A compact one-line basis for the synthesis log-acknowledgement (§6.2:1197) —
 * what committed in this request, phrased with the same `phraseForCard` wording
 * as the fallback receipt. The acknowledgement call passes this as the factual
 * anchor; synthesis reads the entities' full detail from the vault context
 * (they're written before finalize, so they're already in it). Empty string when
 * nothing committed.
 */
export function committedForAck(
  cards: CommitCardInput[],
  results: CommitCardResult[],
): string {
  return cards
    .filter((_, i) => results[i]?.ok)
    .map((card) => phraseForCard(card))
    .join("; ");
}
