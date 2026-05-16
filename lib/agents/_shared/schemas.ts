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

// Extraction agent output — per design.md 5.4:763-777
const extractionEntitySchema = z.object({
  intent: z.enum(["create", "update", "uncertain"]),
  target_entity_type: z.string(),
  matched_entity_id: z.string().uuid().nullable(),
  extracted_data: z.record(z.string(), z.unknown()),
  ambiguities: z.array(z.string()),
  source_excerpt: z.string(),
});
export const extractionOutputSchema = z.object({
  extractions: z.array(extractionEntitySchema),
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
const insightSchema = z.object({
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
  triggered_by: insightEntityRefSchema,
  cited_sources: z.array(insightCitedSourceSchema),
  external_refs: z.array(insightExternalRefSchema).optional(),
  linked_entities: z.array(insightEntityRefSchema).optional(),
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
