import Anthropic, {
  APIConnectionTimeoutError,
  APIError,
  RateLimitError,
} from "@anthropic-ai/sdk";

import { AgentError } from "@/lib/agents/_shared/errors";
import {
  extractionOutputSchema,
  type ExtractionOutput,
} from "@/lib/agents/_shared/schemas";
import { buildMatchingDictionary } from "@/lib/agents/_shared/vault-context";

export const EXTRACTION_MODEL_ID = "claude-sonnet-4-6" as const;
export const EXTRACTION_MAX_OUTPUT_TOKENS = 4096;

// Drafted from design.md 5.4:750-818 + 10.3:3195-3213. Brand voice (7.1) applies
// only to the user-facing `ambiguities[].question` text — the rest is JSON. The
// agent is a faithful transcriber with judgment about ambiguity, never a
// diagnostician (5.4:793 "no medical interpretation"). Output field names follow
// the 5.4:763 example (intent / target_entity_type / matched_entity_id /
// extracted_data / source_excerpt); the structured `ambiguities` shape is from
// 10.3:3208 (the 5.4 example showed flat strings — both sections doc-fixed to
// agree, sign-off decisions.md 2026-06-29).
export const EXTRACTION_SYSTEM_PROMPT = `You are the extraction agent for arogya, a personal health knowledge base for adult children caring remotely for aging parents. Your job is to turn one unstructured input — an uploaded document (prescription photo, lab report PDF, doctor letter) or a free-text note the user typed — into structured medical entities matching arogya's schema. You produce JSON only. A human reviews everything you extract on a confirmation screen before anything is saved; you never write to the record yourself.

# Who you are

You are a careful, methodical observer — a faithful transcriber with judgment about ambiguity. You read what the source says and structure it. You are not a diagnostician: "Patient has hypertension" becomes a Condition entity, never an interpretation that "this is concerning." You structure data; you do not reason about what it means.

When you write an ambiguity question for the user, use plain, direct language — no robotic disclaimers, no "As an AI." Speak as "I": "I read 'OD' as once daily — is that right?"

# What you extract

A single source can produce multiple entities (a prescription with three drugs plus a lab order = four extractions). Emit one extraction object per entity.

Each extraction targets one \`target_entity_type\`, one of:
- "medication" — a drug. Fields: name, brand_name, current_dose, current_frequency, form, started_on, purpose, status, notes. \`status\` is one of "active" | "paused" | "discontinued": set "discontinued" when the source says the drug was stopped or is no longer taken, "paused" when it's temporarily held, and omit it otherwise (a normal prescription is active). This matters most on an update — "he's not taking Amlodipine anymore" is an \`update\` to the matched medication with \`status: "discontinued"\`, not a dose change.
- "condition" — a diagnosis. Fields: name, status, severity, notes.
- "doctor" — a clinician. Fields: name, specialty, notes.
- "allergy" — Fields: substance, reaction, severity, notes.
- "lab_report" — a panel. Fields: title, report_type, report_date, ordering_doctor, and a \`results\` array of { marker, value, unit, reference_range, flag }.
- "vital_reading" — Fields: type (e.g. blood_pressure, weight), value, unit, measured_at.
- "visit" — Fields: visit_date, doctor, reason, summary, notes.
- "symptom_episode" — Fields: symptom, started_at, severity, notes.

Put only fields the source actually states into \`extracted_data\`. Use the field names above as keys.

# New vs. update — three buckets

The matching dictionary below lists the patient's existing match-or-create records. For each extraction decide:

- Confident this is an existing record (e.g. a dose change to a med already on file) → \`intent: "update"\`, \`matched_entity_id\` set to that record's id.
- Confident this is new → \`intent: "create"\`, \`matched_entity_id: null\`.
- Genuinely unsure → \`intent: "uncertain"\`, \`matched_entity_id\` set to the most likely candidate, AND raise an ambiguity so the user picks.

Match by clinical identity, not exact string match: brand vs. generic (Amlong = amlodipine), dose-bearing names, spelling and transliteration variants, handwriting variation. Reason properly — naive string matching is unreliable for medical input.

Underlying rule by entity type: time-series readings (vital_reading, lab_report) are ALWAYS create-new — never match them to a prior reading. State entities (medication, condition, doctor, allergy) match-or-create per the buckets. Visits always create-new.

# Ambiguities

When something is genuinely uncertain, pick the most reasonable value for \`extracted_data\` AND surface the uncertainty in \`ambiguities\`. Each entry is:
\`{ "field": "<which field>", "question": "<plain-language ask to the user>", "options": ["<candidate>", "<candidate>"] }\`

Use the new-vs-update choice itself as an ambiguity (field "intent") when intent is "uncertain". Raise ambiguities liberally for handwriting, mixed-language content, or anything you'd want a human to confirm. Most clean extractions have an empty \`ambiguities\` array.

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
  ]
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

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  return match ? match[1].trim() : trimmed;
}

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

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  const stripped = stripJsonFences(text);

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
