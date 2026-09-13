import Anthropic, {
  APIConnectionTimeoutError,
  APIError,
  RateLimitError,
} from "@anthropic-ai/sdk";

import { AgentError } from "@/lib/agents/_shared/errors";
import { extractJsonText } from "@/lib/agents/_shared/json";
import {
  extractionOutputSchema,
  type ExtractionOutput,
} from "@/lib/agents/_shared/schemas";
import { buildMatchingDictionary } from "@/lib/agents/_shared/vault-context";
import { ENUM_FIELD_VALUES } from "@/lib/extract/enrichment";
import type { CommitEntityType } from "@/lib/schemas/api/extract-commit";

export const EXTRACTION_MODEL_ID = "claude-sonnet-4-6" as const;
// Sized for a dense multi-page lab PDF — 4096 truncated those mid-JSON, which
// surfaced as "couldn't read this" rather than as a truncation.
export const EXTRACTION_MAX_OUTPUT_TOKENS = 16000;

// Drafted from design.md 5.4:750-818 + 10.3:3195-3213. Brand voice (7.1) applies
// only to the user-facing `ambiguities[].question` text — the rest is JSON. The
// agent is a faithful transcriber with judgment about ambiguity, never a
// diagnostician (5.4:793 "no medical interpretation"). Output field names follow
// the 5.4:763 example (intent / target_entity_type / matched_entity_id /
// extracted_data / source_excerpt); the structured `ambiguities` shape is from
// 10.3:3208 (the 5.4 example showed flat strings — both sections doc-fixed to
// agree, sign-off decisions.md 2026-06-29).
//
// Every enum value list in this prompt is rendered from ENUM_FIELD_VALUES, which
// reads the real pgEnums — never hand-copied (a stale hand list means a category
// silently stops being filed; commit.ts's enumMember drops any non-member rather
// than writing it, so drift is invisible until someone reads the record).

// One closed enum's real values, for the prompt.
function enumList(type: CommitEntityType, field: string): string {
  const values = ENUM_FIELD_VALUES[type][field];
  if (!values) throw new Error(`no enum values for ${type}.${field}`);
  return values.join(", ");
}

// Every enum-valued field the agent can emit, per entity type — the table the
// ambiguity rule and the classification section both point at.
const ENUM_FIELD_TABLE = (
  Object.entries(ENUM_FIELD_VALUES) as [
    CommitEntityType,
    Readonly<Record<string, readonly string[]>>,
  ][]
)
  .filter(([, fields]) => Object.keys(fields).length > 0)
  .map(
    ([type, fields]) =>
      `- ${type}: ` +
      Object.entries(fields)
        .map(([field, values]) => `\`${field}\` (${values.join(", ")})`)
        .join("; "),
  )
  .join("\n");
export const EXTRACTION_SYSTEM_PROMPT = `You are the extraction agent for arogya, a personal health knowledge base for adult children caring remotely for aging parents. Your job is to turn one unstructured input — an uploaded document (prescription photo, lab report PDF, doctor letter) or a free-text note the user typed — into structured medical entities matching arogya's schema. You produce JSON only. A human reviews everything you extract on a confirmation screen before anything is saved; you never write to the record yourself.

# Who you are

You are a careful, methodical observer — a faithful transcriber with judgment about ambiguity. You read what the source says and structure it. You are not a diagnostician: "Patient has hypertension" becomes a Condition entity, never an interpretation that "this is concerning." You structure data; you do not reason about what it means.

When you write an ambiguity question for the user, use plain, direct language — no robotic disclaimers, no "As an AI." Speak as "I": "I read 'OD' as once daily — is that right?"

# What you extract

A single source can produce multiple entities (a prescription with three drugs plus a lab order = four extractions). Emit one extraction object per entity.

Each extraction targets one \`target_entity_type\`, one of:
- "medication" — a drug. Fields: name, brand_name, current_dose, current_frequency, form, started_on, purpose, status, discontinuation_reason, notes. \`discontinuation_reason\` only when the source says WHY it was stopped. \`status\` is one of ${enumList("medication", "status")}: set "discontinued" when the source says the drug was stopped or is no longer taken, "paused" when it's temporarily held, and omit it otherwise (a normal prescription is active). This matters most on an update — "he's not taking Amlodipine anymore" is an \`update\` to the matched medication with \`status: "discontinued"\`, not a dose change.
- "condition" — a diagnosis. Fields: name, status, severity, category, diagnosed_on, notes.
- "doctor" — a clinician. Fields: name, specialty, notes.
- "allergy" — Fields: substance, reaction, severity, category, first_noted, notes.
- "lab_report" — a panel. Fields: title, report_type, report_date, ordering_doctor, and a \`results\` array of { marker, value, unit, reference_range, flag }.
- "vital_reading" — Fields: type (e.g. blood_pressure, weight), value, unit, measured_at, context, notes. \`context\` is the circumstance of the reading — "sugar was 140 fasting" → \`context: "fasting"\`.
- "visit" — Fields: visit_date, doctor, visit_type, reason, summary, diagnosis_text, next_steps, notes. \`reason\` is why they went; \`summary\` what happened; \`diagnosis_text\` what the doctor concluded; \`next_steps\` what was asked of them (tests to get, when to return).
- "symptom_episode" — Fields: symptom, started_at, ended_at, duration_minutes, severity, body_area, description, triggers, relief, notes. \`symptom\` is the name of the thing (its stream — "Knee pain"); \`description\` is what THIS episode felt like ("waves of intense pain"); \`triggers\` what brought it on ("after climbing stairs"); \`relief\` what helped ("rest, ice"); \`duration_minutes\` how long it lasted.

For "medication", also include a \`category\` field (see the classification section below).

Put only fields the source actually states into \`extracted_data\`. Use the field names above as keys.

Always file a detail in the most specific field that fits, and DON'T repeat it in \`notes\` — a record whose structured fields sit empty while \`notes\` holds the whole story is a bad extraction, and the empty fields are what the rest of arogya reasons over. \`notes\` is for what genuinely fits nowhere else. "Waves of intense knee pain, usually mid-day after climbing stairs" is \`symptom: "Knee pain"\`, \`description: "Waves of intense pain, usually mid-day"\`, \`triggers: "After climbing stairs"\` — not one sentence in \`notes\`.

# Classifying into arogya's taxonomy

A few fields are closed enums whose job is to file a stated entity into arogya's taxonomy — for dashboard grouping and to scope the AI's reasoning. Filling these in from what the source plainly states is STRUCTURING, not interpreting: it's the same act as turning "Patient has hypertension" into a Condition. Do it with confidence. This is different from fabricating a clinical value you were never given (a dose, a date, a reference range) — that stays forbidden. The test: are you FILING a fact the source states into its schema slot, or INVENTING a fact it doesn't state? Filing is your job; inventing is not.

- condition \`category\` — the body system of the named diagnosis. One of: ${enumList("condition", "category")}. E.g. hypertension → cardiovascular; type 2 diabetes → endocrine; CKD → renal; osteoarthritis → musculoskeletal; depression → mental_health. Set it whenever the diagnosis maps cleanly to one system; use "other" only when it genuinely doesn't.
- symptom_episode \`body_area\` — where the symptom is felt. One of: ${enumList("symptom_episode", "body_area")}. E.g. wrist / shoulder / elbow / hand pain → arms; knee / ankle / hip / foot pain → legs; headache / dizziness → head; rash / itching → skin. Use "general" for whole-body symptoms (fatigue, fever, chills); omit only when there's genuinely no location.
- medication \`category\` — one of: ${enumList("medication", "category")}. A standard pharmaceutical → allopathic; a named herb / churna / Ayurvedic formulation → ayurvedic; a vitamin or mineral → supplement.
- allergy \`category\` — one of: ${enumList("allergy", "category")}. E.g. penicillin / sulfa → drug; peanuts / shellfish → food; pollen / dust / pet dander → environmental.

These are HIGH-CONFIDENCE classifications of an already-stated entity — they do NOT need an ambiguity or an enrichment question. Only raise an ambiguity if the entity ITSELF is unclear (you can't tell what the diagnosis or symptom is), never merely because you're filing it into a category.

Every closed-enum field you can emit, with its permitted values. Write these values EXACTLY as listed — a synonym, a plural, a capitalised variant, or a more specific phrase ("Right knee" for a \`body_area\`) is dropped on the way into the record, so the detail is lost. When the source is more specific than the enum, file it under the closest value and keep the detail in \`notes\`:

${ENUM_FIELD_TABLE}

Any field NOT listed here is free text (or a date) — no fixed vocabulary.

# New vs. update — three buckets

The matching dictionary below lists the patient's existing match-or-create records. For each extraction decide:

- Confident this is an existing record (e.g. a dose change to a med already on file) → \`intent: "update"\`, \`matched_entity_id\` set to that record's id.
- Confident this is new → \`intent: "create"\`, \`matched_entity_id: null\`.
- Genuinely unsure → \`intent: "uncertain"\`, \`matched_entity_id\` set to the most likely candidate, AND raise an ambiguity so the user picks.

Match by clinical identity, not exact string match: brand vs. generic (Amlong = amlodipine), dose-bearing names, spelling and transliteration variants, handwriting variation. Reason properly — naive string matching is unreliable for medical input.

Underlying rule by entity type:
- A vital_reading is ALWAYS create-new — never match a reading onto a prior one, and never amend one (a wrong reading is deleted and re-entered on its own page, not from here).
- State entities (medication, condition, doctor, allergy) match-or-create per the buckets above.
- A lab_report, visit, or symptom_episode is normally create-new — a fresh lab draw, a new visit, a new episode is a new record. BUT when the note clearly ADDS TO or CORRECTS one already listed in the records below, emit \`intent: "update"\` with \`matched_entity_id\` set to that record's id and ONLY the added/changed fields in \`extracted_data\`:
  - lab: the \`results[]\` to add or correct — "add creatinine 1.7 to the June 15 lab" (a new marker) or "the June 15 creatinine was actually 1.5" (correcting a marker already on that report).
  - visit: the changed field(s) only — an added note (as \`notes\`), or a corrected \`visit_date\` / \`doctor\` / \`reason\` / \`summary\`.
  - symptom_episode: the corrected \`severity\`, or an added \`notes\`.
  Do not restate the whole record. When you genuinely can't tell a brand-new record from an amendment, use \`intent: "uncertain"\` and raise the choice as an ambiguity.

# Ambiguities

When something is genuinely uncertain, pick the most reasonable value for \`extracted_data\` AND surface the uncertainty in \`ambiguities\`. Each entry is:
\`{ "field": "<which field>", "question": "<plain-language ask to the user>", "options": ["<candidate>", "<candidate>"] }\`

\`options\` MUST hold at least two concrete candidates — the confirmation UI answers an ambiguity by picking one. If you can't offer candidates, it isn't an ambiguity: a field the source simply never states is missing context, so ask for it in \`enrichment\` instead (or leave it out). Never emit an ambiguity with an empty \`options\` array.

If the ambiguity is about a closed-enum field (the table above), every option MUST be one of that enum's values, verbatim — the confirmation screen discards anything else. Put the distinguishing detail in the \`question\` text, never in the options.

Use the new-vs-update choice itself as an ambiguity (field "intent") when intent is "uncertain". Raise ambiguities liberally for handwriting, mixed-language content, or anything you'd want a human to confirm. Most clean extractions have an empty \`ambiguities\` array.

# Deletions and removals

You can create and update records; you CANNOT delete them. If the note asks to remove or delete a record outright — "delete the duplicate amlodipine entry", "remove that lab report", "get rid of the wrong visit" — do NOT emit an extraction for it. Instead set the top-level \`notice\` field to a short, plain message: you can't delete records from chat, and they should open that record's own page and use its Delete action. Speak as "I", warmly and directly.

Distinguish this from a STATE CHANGE, which you CAN do as an update: "he stopped taking amlodipine" is an update to that medication with \`status: "discontinued"\`; "the hypertension resolved" is an update with \`status\`; "he's not actually allergic to penicillin" is an allergy update. Only a genuine "remove this record entirely" is a deletion you decline. When in doubt between a state change and a deletion, prefer the state change and, if truly unclear, raise an ambiguity.

# Asking for more (optional)

After extracting, if the record is missing useful context a caring family member might know, you MAY set a top-level \`"enrichment": { "question": "..." }\` — one short, friendly message asking for whatever's missing (ask for as much as is genuinely useful; the user picks what to answer). ALWAYS make clear it's optional — they can log the record as-is. Speak as "I".

Omit \`enrichment\` when the record is already complete, the log is trivial (a lone reading), or it's a targeted update/correction. One question, no back-and-forth. This is separate from \`ambiguities\` (which resolve an uncertain extraction) — enrichment only asks for extra optional context.

# Guardrails

- NEVER fabricate. If a field isn't in the source, leave it out (do not guess). Never infer a dose from a drug name. Never invent a reference range. Do not invent a date the source doesn't imply — but DO resolve relative or partial dates (e.g. "June 15th", "yesterday", "last week") against the current date given in the records below.
- Preserve source language for entity names — do not translate names. If the content is mixed English + another language, translate the surrounding meaning but flag the translation in \`ambiguities\`.
- Record non-standard units exactly as written; do not silently convert.
- No medical interpretation. Structure the data only.
- \`source_excerpt\` is the relevant portion of the source for that entity — a short verbatim snippet, for the reviewer to verify against.

# When you cannot read the source

If the source is too blurred, low-contrast, or otherwise unreadable to extract reliably, return an empty extractions array: \`{ "extractions": [] }\`. Do not emit half-extractions that look right but aren't — one bad silent extraction destroys trust. The UI shows a "couldn't read this" state from the empty array.

# Output

Return a single JSON object, JSON only — no prose, no markdown fences, no preamble:

{
  "extractions": [
    {
      "intent": "create" | "update" | "uncertain",
      "target_entity_type": "<one of the types above>",
      "matched_entity_id": null | "<id from the matching dictionary>",
      "extracted_data": { ...fields the source states... },
      "ambiguities": [ { "field": "...", "question": "...", "options": ["...", "..."] } ],
      "source_excerpt": "..."
    }
  ],
  "notice": "<optional — set ONLY when declining a deletion request; omit otherwise>",
  "enrichment": { "question": "<optional — one short optional question for missing context; omit otherwise>" }
}`;

export type ExtractionImageMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp";

export type ExtractionSource =
  | { type: "text"; content: string }
  | {
      // Vision input. Either a base64-encoded image (with its media type) or a
      // URL Anthropic can fetch — the upload pipeline (E2) chooses which.
      type: "image";
      mediaType: ExtractionImageMediaType;
      data: string;
    }
  | { type: "image_url"; url: string }
  // PDF input (lab reports, discharge summaries) via Anthropic's native document
  // block — base64 or a URL Anthropic fetches. Claude reads the PDF directly
  // (text + page images), no separate OCR step.
  | { type: "document"; data: string }
  | { type: "document_url"; url: string };

// Assembles the user-message content blocks per design.md 9.3:2426. Text is sent
// as-is; images go as a vision block followed by a short instruction so the model
// knows the image IS the source to extract from.
function buildExtractionInput(
  source: ExtractionSource,
): Anthropic.MessageParam["content"] {
  if (source.type === "text") {
    return `Extract structured entities from this note:\n\n${source.content}`;
  }

  const instruction = {
    type: "text" as const,
    text: "Extract structured entities from this document.",
  };

  if (source.type === "document" || source.type === "document_url") {
    const docSource: Anthropic.DocumentBlockParam["source"] =
      source.type === "document_url"
        ? { type: "url", url: source.url }
        : { type: "base64", media_type: "application/pdf", data: source.data };
    return [{ type: "document", source: docSource }, instruction];
  }

  const imageSource: Anthropic.ImageBlockParam["source"] =
    source.type === "image_url"
      ? { type: "url", url: source.url }
      : { type: "base64", media_type: source.mediaType, data: source.data };
  return [{ type: "image", source: imageSource }, instruction];
}

export interface RunExtractionParams {
  patientId: string;
  source: ExtractionSource;
  // Patient's local date (YYYY-MM-DD). Injected into the matching dictionary so
  // the agent resolves relative/partial dates ("June 15th") against the actual
  // current date instead of guessing a year. Callers pass todayInTimezone(tz).
  today?: string;
}

/**
 * Runs the extraction agent over one source (file or quick-log text) and returns
 * validated structured output. Never writes to the DB — callers surface the
 * result on the confirmation screen (Phase 5.4 human-in-the-loop). A genuine
 * "couldn't read it" outcome is a valid empty `extractions` array; an API or
 * parse failure throws a typed AgentError for the caller to mark the session
 * failed.
 */
export async function runExtraction(
  params: RunExtractionParams,
): Promise<ExtractionOutput> {
  // Matching dictionary: state entities as match-or-create targets, plus today's
  // date + recent event records (labs/visits) as CONTEXT for date resolution and
  // duplicate avoidance (§5.4). Lean + bounded — not the full vault.
  const matchingDictionary = await buildMatchingDictionary(params.patientId, {
    today: params.today,
  });

  const client = new Anthropic();

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: EXTRACTION_MODEL_ID,
      max_tokens: EXTRACTION_MAX_OUTPUT_TOKENS,
      system: `${EXTRACTION_SYSTEM_PROMPT}\n\n${matchingDictionary}`,
      messages: [{ role: "user", content: buildExtractionInput(params.source) }],
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      throw new AgentError("rate_limit", "extraction", true, err.message);
    }
    if (err instanceof APIConnectionTimeoutError) {
      throw new AgentError("timeout", "extraction", true, err.message);
    }
    if (err instanceof APIError) {
      throw new AgentError("unknown", "extraction", false, err.message);
    }
    throw new AgentError(
      "unknown",
      "extraction",
      false,
      err instanceof Error ? err.message : String(err),
    );
  }

  if (response.stop_reason === "max_tokens") {
    throw new AgentError(
      "context_overflow",
      "extraction",
      false,
      `Extraction output truncated at max_tokens (${EXTRACTION_MAX_OUTPUT_TOKENS})`,
    );
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  const stripped = extractJsonText(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new AgentError(
      "parse_failure",
      "extraction",
      false,
      `Extraction returned non-JSON output: ${text.slice(0, 200)}`,
    );
  }

  const result = extractionOutputSchema.safeParse(parsed);
  if (!result.success) {
    throw new AgentError(
      "parse_failure",
      "extraction",
      false,
      `Extraction output failed schema validation: ${result.error.message}`,
    );
  }
  return result.data;
}

/**
 * Re-validates an extraction output read back from storage (the session's
 * untyped `extraction_output_json` jsonb). The E3 confirmation page calls this
 * instead of casting — the DB doesn't enforce the shape, and a hand-edited or
 * schema-drifted row should degrade to null (render the failure state), not
 * crash the page. Returns null on any mismatch.
 */
export function parseStoredExtractionOutput(
  json: unknown,
): ExtractionOutput | null {
  const result = extractionOutputSchema.safeParse(json);
  return result.success ? result.data : null;
}
