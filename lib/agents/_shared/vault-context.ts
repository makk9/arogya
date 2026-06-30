// Server-only boundary lives at `@/lib/env` (canonical layer). This module inherits it
// transitively via `@/db/queries` → `@/db` → `@/lib/env`.

import {
  allergyChangeQueries,
  allergyQueries,
  conditionChangeQueries,
  conditionQueries,
  doctorChangeQueries,
  doctorQueries,
  familyHistoryQueries,
  insightQueries,
  journalQueries,
  labReportQueries,
  labResultQueries,
  lifestyleChangeQueries,
  lifestyleQueries,
  medicationChangeQueries,
  medicationQueries,
  patientQueries,
  reportQueries,
  symptomEpisodeQueries,
  symptomTypeQueries,
  visitQueries,
  vitalQueries,
} from "@/db/queries";

import {
  allergySlug,
  conditionSlug,
  doctorSlug,
  familyHistorySlug,
  insightSlug,
  journalEntrySlug,
  labReportSlug,
  labResultSlug,
  lifestyleSlug,
  medicationSlug,
  patientSlug,
  reportSlug,
  serializeAllergies,
  serializeConditions,
  serializeDoctors,
  serializeFamilyHistory,
  serializeInsights,
  serializeJournalEntries,
  serializeLabReports,
  serializeLifestyle,
  serializeMedications,
  serializePatient,
  serializeReports,
  serializeSymptoms,
  serializeVisits,
  serializeVitalReadings,
  symptomEpisodeSlug,
  symptomTypeSlug,
  visitSlug,
  vitalReadingSlug,
  type SlugIndex,
} from "./serializers";

export interface BuildVaultContextOptions {
  /**
   * When true (the default), Brief entities are excluded from the serialized vault.
   * Briefs are not a v1 entity; this flag is a v1.5 forward-compatibility tripwire
   * per CLAUDE.md and design.md 5.7 / 9.3:2376. The Brief serializer will be wired
   * in here when the entity lands; today the flag has no data path.
   */
  excludeBriefs?: boolean;

  /**
   * "full"                — emit insights with conversational-context framing (synthesis).
   * "deduplication-only" — emit insights with strict anti-echo-chamber framing (insight generator).
   * "none"                — omit the insights section entirely (extraction, router, onboarding).
   * Default: "full".
   */
  includeInsights?: "deduplication-only" | "full" | "none";

  /**
   * Optional surface tag indicating the user opened the agent from a specific entity page
   * (e.g. "The user is viewing the medication: amlodipine"). Appended at the end of the
   * returned string per design.md 5.3 + 10.3:3174.
   */
  surfaceContext?: string;
}

/**
 * Builds the canonical vault context string for a patient.
 *
 * Determinism contract: same vault state + same `now` → byte-identical output. The
 * function is idempotent per request; `now` is a per-request anchor for wall-clock-
 * relative values (e.g. patient age). This enables Anthropic prompt caching downstream
 * — the cache key is the full system+vault block, and we want hits on identical state.
 *
 * Always loads the full vault. No RAG, no recency filter (per design.md 5.3:686-688).
 */
export async function buildVaultContext(
  patientId: string,
  options: BuildVaultContextOptions = {},
  now: Date = new Date(),
): Promise<string> {
  const {
    excludeBriefs: _excludeBriefs = true,
    includeInsights = "full",
    surfaceContext,
  } = options;

  // Brief exclusion is enforced here when the Brief entity lands (v1.5). No v1 data path.
  void _excludeBriefs;

  const patient = await patientQueries.getById(patientId);
  if (!patient) {
    throw new Error(`vault-context: patient ${patientId} not found`);
  }

  const [
    doctors,
    doctorChanges,
    conditions,
    conditionChanges,
    medications,
    medicationChanges,
    allergies,
    allergyChanges,
    lifestyleProfile,
    lifestyleChanges,
    familyHistoryEntries,
    visits,
    labReports,
    labResults,
    vitalReadings,
    symptomTypes,
    symptomEpisodes,
    reportsRaw,
    journalEntries,
    insightsRaw,
  ] = await Promise.all([
    doctorQueries.forPatient(patientId),
    doctorChangeQueries.forPatient(patientId),
    conditionQueries.forPatient(patientId),
    conditionChangeQueries.forPatient(patientId),
    medicationQueries.forPatient(patientId),
    medicationChangeQueries.forPatient(patientId),
    allergyQueries.forPatient(patientId),
    allergyChangeQueries.forPatient(patientId),
    lifestyleQueries.getForPatient(patientId),
    lifestyleChangeQueries.forPatient(patientId),
    familyHistoryQueries.forPatient(patientId),
    visitQueries.forPatient(patientId),
    labReportQueries.forPatient(patientId),
    labResultQueries.forPatient(patientId),
    vitalQueries.forPatient(patientId),
    symptomTypeQueries.forPatient(patientId),
    symptomEpisodeQueries.forPatient(patientId),
    reportQueries.forPatient(patientId),
    journalQueries.forPatient(patientId),
    includeInsights === "none"
      ? Promise.resolve([])
      : insightQueries.forPatient(patientId),
  ]);

  const reports = reportsRaw.filter(
    (r) => r.status === "ready" || r.status === "committed",
  );
  const insights = insightsRaw.filter((i) => i.status !== "dismissed");

  // Slug deduplication: collisions get -2, -3 suffixes in stable id-ASC order.
  // Semantically meaningful disambiguation (e.g. med:amlodipine-5mg vs med:amlodipine-10mg)
  // is a v1.5 polish item — not built now.
  const slugIndex: SlugIndex = new Map();
  const counts = new Map<string, number>();

  const addAll = <T extends { id: string }>(
    rows: readonly T[],
    toSlug: (row: T) => string,
  ): void => {
    const sortedById = rows
      .slice()
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    for (const row of sortedById) {
      const base = toSlug(row);
      const count = counts.get(base) ?? 0;
      const finalSlug = count === 0 ? base : `${base}-${count + 1}`;
      counts.set(base, count + 1);
      slugIndex.set(row.id, finalSlug);
    }
  };

  addAll([patient], patientSlug);
  addAll(doctors, doctorSlug);
  addAll(conditions, conditionSlug);
  addAll(medications, medicationSlug);
  addAll(allergies, allergySlug);
  if (lifestyleProfile) addAll([lifestyleProfile], lifestyleSlug);
  addAll(familyHistoryEntries, familyHistorySlug);
  addAll(visits, visitSlug);
  addAll(labReports, labReportSlug);
  addAll(labResults, labResultSlug);
  addAll(vitalReadings, vitalReadingSlug);
  addAll(symptomTypes, symptomTypeSlug);
  addAll(symptomEpisodes, symptomEpisodeSlug);
  addAll(reports, reportSlug);
  addAll(journalEntries, journalEntrySlug);
  addAll(insights, insightSlug);

  const sections: string[] = [
    serializePatient(patient, now),
    serializeAllergies(allergies, allergyChanges, slugIndex),
    serializeConditions(conditions, conditionChanges, slugIndex),
    serializeMedications(medications, medicationChanges, slugIndex),
    serializeDoctors(doctors, doctorChanges),
    serializeFamilyHistory(patient, familyHistoryEntries),
    serializeLifestyle(lifestyleProfile, lifestyleChanges),
    serializeVisits(visits, slugIndex),
    serializeLabReports(labReports, labResults, slugIndex),
    serializeVitalReadings(vitalReadings, slugIndex),
    serializeSymptoms(symptomTypes, symptomEpisodes, slugIndex),
    serializeReports(reports, slugIndex),
    serializeJournalEntries(journalEntries, slugIndex),
    includeInsights === "none"
      ? ""
      : serializeInsights(insights, includeInsights, slugIndex),
  ];

  const body = sections.filter((s) => s.length > 0).join("\n\n");

  if (surfaceContext && surfaceContext.length > 0) {
    return `${body}\n\n<surface_context>${surfaceContext}</surface_context>`;
  }
  return body;
}

/**
 * Builds the extraction agent's "matching dictionary" per design.md 5.4:757 —
 * the patient's existing match-or-create state entities as names + UUIDs, with
 * NO change logs and NO event entities. Deliberately distinct from
 * {@link buildVaultContext}: that serializer emits slug citations (`§ med:x`),
 * not UUIDs, so it cannot satisfy the extraction output's `matched_entity_id`
 * (a real uuid). This is the lightweight new-vs-update reasoning context — not
 * the full vault — and lives here so it shares the canonical query layer rather
 * than reading the DB directly (CLAUDE.md tripwire). Decision: decisions.md
 * 2026-06-29.
 *
 * Per Phase 3 + 5.4:787, only state entities match-or-create. Time-series
 * readings (vitals, labs) and events (visits, reports) are always create-new,
 * so they're absent here by design — there's nothing to match against.
 */
export async function buildMatchingDictionary(
  patientId: string,
): Promise<string> {
  const [medications, conditions, doctors, allergies] = await Promise.all([
    medicationQueries.forPatient(patientId),
    conditionQueries.forPatient(patientId),
    doctorQueries.forPatient(patientId),
    allergyQueries.forPatient(patientId),
  ]);

  const sections: string[] = [];

  if (medications.length > 0) {
    const lines = medications.map((m) => {
      const brand = m.brandName ? ` (brand ${m.brandName})` : "";
      const dose = [m.currentDose, m.currentFrequency]
        .filter((v) => v && v.length > 0)
        .join(", ");
      const doseTail = dose.length > 0 ? ` — ${dose}` : "";
      return `- ${m.name}${brand}${doseTail}, ${m.status} (id: ${m.id})`;
    });
    sections.push(["## Medications", ...lines].join("\n"));
  }

  if (conditions.length > 0) {
    const lines = conditions.map(
      (c) => `- ${c.name}, ${c.status} (id: ${c.id})`,
    );
    sections.push(["## Conditions", ...lines].join("\n"));
  }

  if (doctors.length > 0) {
    const lines = doctors.map(
      (d) => `- ${d.name} — ${d.specialty} (id: ${d.id})`,
    );
    sections.push(["## Doctors", ...lines].join("\n"));
  }

  if (allergies.length > 0) {
    const lines = allergies.map(
      (a) => `- ${a.substance}, ${a.status} (id: ${a.id})`,
    );
    sections.push(["## Allergies", ...lines].join("\n"));
  }

  if (sections.length === 0) {
    return "# Existing records (matching dictionary)\n\nNo existing records yet — treat every extraction as a new entity (intent: \"create\").";
  }

  return [
    "# Existing records (matching dictionary)",
    "",
    "These are the patient's existing match-or-create records. Use them to decide new-vs-update by clinical identity — brand vs. generic names, dose-bearing record names, spelling and transliteration variants — not exact string match. When an extraction matches one of these, set `matched_entity_id` to its id.",
    "",
    ...sections,
  ].join("\n");
}
