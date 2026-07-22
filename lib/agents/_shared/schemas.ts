import { z } from "zod";

// Router agent output — per design.md 5.5:833-837 + 10.3:3214 + 9.3:2446.
// `intent` describes what the user typed (not the destination agent); three-bucket
// confidence gives the UI room to gate the disambiguator on medium-confidence
// inputs without forcing the explicit `ambiguous` intent.
export const routerOutputSchema = z.object({
  intent: z.enum(["question", "log", "ambiguous"]),
  confidence: z.enum(["high", "medium", "low"]),
  reasoning: z.string(),
});
export type RouterOutput = z.infer<typeof routerOutputSchema>;

// Extraction agent output — per design.md 5.4:763-777, with the structured
// `ambiguities` shape from 10.3:3208 (the §5.4 example showed flat strings; the
// §6.11 confirmation UI needs {field,question,options} to drive inline-resolve
// chips that block Confirm until answered). Field names follow the §5.4 example;
// both sections doc-fixed to agree. Sign-off: decisions.md 2026-06-29.
const extractionAmbiguitySchema = z.object({
  field: z.string(),
  question: z.string(),
  options: z.array(z.string()),
});
const extractionEntitySchema = z.object({
  intent: z.enum(["create", "update", "uncertain"]),
  target_entity_type: z.string(),
  matched_entity_id: z.string().uuid().nullable(),
  extracted_data: z.record(z.string(), z.unknown()),
  ambiguities: z.array(extractionAmbiguitySchema),
  source_excerpt: z.string(),
});
export const extractionOutputSchema = z.object({
  extractions: z.array(extractionEntitySchema),
  // Optional advisory shown on the §6.11 confirmation screen when the agent did
  // something other than extract. Today's only use: the user asked to DELETE a
  // record, which the agent can't do from chat — it returns no extraction for
  // that and a voice-compliant `notice` telling them to remove it on the record's
  // own page. Additive + optional; older stored outputs without it still parse.
  // `.nullish()`, not `.optional()`: the model sometimes emits an explicit
  // `null` for these instead of omitting them (seen on the empty-extraction
  // "couldn't read it" path), and a valid null outcome must not fail validation.
  notice: z.string().nullish(),
  // Optional guided-scribe nudge (decisions.md 2026-07-17): when a log is sparse
  // and useful context is missing, the agent may ask ONE short, optional question
  // in the chat before the confirmation opens. Additive + optional.
  enrichment: z.object({ question: z.string() }).nullish(),
});
export type ExtractionEntity = z.infer<typeof extractionEntitySchema>;
export type ExtractionOutput = z.infer<typeof extractionOutputSchema>;

// Insight generator output — per design.md 5.6 + 10.3:3235, shape matches `insights` table jsonb
const insightEntityRefSchema = z.object({
  type: z.string(),
  id: z.string().uuid(),
});
const insightCitedSourceSchema = z.object({
  type: z.string(),
  id: z.string().uuid(),
  snippet: z.string(),
});
const insightExternalRefSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  snippet: z.string(),
});
// `triggered_by` is deliberately absent from the agent-output shape (deviation
// from the §4 row shape, decisions.md 2026-07-20): the server knows exactly
// which entity fired the run and stamps `triggered_by` at insert. Asking the
// model to echo it back would be a fabrication vector, not information.
// Exported (not just the wrapper) so the parser can salvage per-insight: one
// malformed element must not discard a run that also found a real insight.
export const insightSchema = z.object({
  title: z.string(),
  body: z.string(),
  category: z.enum([
    "pattern",
    "trend",
    "improvement",
    "interaction",
    "gap",
    "risk",
  ]),
  severity: z.enum(["urgent", "attention", "watch", "informational"]),
  cited_sources: z.array(insightCitedSourceSchema),
  // Tolerated in the parse but stripped before insert — v1 has no web-search
  // tool, and prompt-emitted URLs are the hallucination path (decisions.md
  // 2026-07-19 external-citations deferral).
  external_refs: z.array(insightExternalRefSchema).nullish(),
  linked_entities: z.array(insightEntityRefSchema).nullish(),
});
export const insightGeneratorOutputSchema = z.object({
  insights: z.array(insightSchema),
});
export type GeneratedInsight = z.infer<typeof insightSchema>;
export type InsightGeneratorOutput = z.infer<
  typeof insightGeneratorOutputSchema
>;

// Onboarding agent output — per design.md 10.3:3255, alternating chat + entity emissions
const onboardingChatChunkSchema = z.object({
  kind: z.literal("chat"),
  content: z.string(),
});
const onboardingEntityChunkSchema = z.object({
  kind: z.literal("entity"),
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
});
export const onboardingTurnOutputSchema = z.object({
  emissions: z.array(
    z.discriminatedUnion("kind", [
      onboardingChatChunkSchema,
      onboardingEntityChunkSchema,
    ]),
  ),
  phase: z
    .enum([
      "patient",
      "conditions",
      "medications",
      "doctors",
      "allergies",
      "family_history",
      "lifestyle",
      "loose_ends",
      "complete",
    ])
    .optional(),
});
export type OnboardingTurnOutput = z.infer<typeof onboardingTurnOutputSchema>;
