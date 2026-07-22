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

  /**
   * When true, append an "Entity ID directory" section mapping every vault slug to its
   * `{type, uuid}` pair. Built for the insight generator (§5.6), whose structured output
   * (`cited_sources` / `linked_entities`) needs real entity UUIDs — the serialized vault
   * is deliberately slug-only. Default false: synthesis/extraction/router output stays
   * byte-identical (decisions.md 2026-07-20).
   */
  includeEntityIdDirectory?: boolean;
}

// Slug prefixes excluded from the entity ID directory: insights are never
// citable as evidence (§5.6 anti-echo-chamber); patient/lifestyle are ambient
// context, not citation targets; lab results cite their parent `lab-report`
// with the marker in the snippet (matching the §6.9 cited-sources rendering).
const ID_DIRECTORY_EXCLUDED_PREFIXES = new Set([
  "insight",
  "patient",
  "lifestyle",
  "lab-result",
]);

function serializeEntityIdDirectory(
  slugIndex: SlugIndex,
  // Ids indexed for citation-resolution but NOT serialized in the vault body
  // (quick-log report stubs). The agent can't read their content, so it must
  // not be offered their ids as citation targets (§5.4 stubs-stay-out intent).
  excludeIds: ReadonlySet<string>,
): string {
  const rows = [...slugIndex.entries()]
    .filter(([id]) => !excludeIds.has(id))
    .map(([id, slug]) => ({ id, slug, type: slug.split(":", 1)[0] }))
    .filter((r) => !ID_DIRECTORY_EXCLUDED_PREFIXES.has(r.type))
    // Deterministic order (slug then id) per the caching contract above.
    .sort((a, b) =>
      a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : a.id < b.id ? -1 : 1,
    );
  if (rows.length === 0) return "";

  const lines = rows.map(
    (r) => `- § ${r.slug} → type: ${r.type}, id: ${r.id}`,
  );
  return [
    "# Entity ID directory",
    "",
    "When emitting structured references (cited_sources, linked_entities), use the EXACT",
    "type and UUID listed here for the entity you are citing. Never invent, alter, or",
    "abbreviate an id. Entities not listed here cannot be cited in structured output.",
    "",
    ...lines,
  ].join("\n");
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
    includeEntityIdDirectory = false,
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
    reportsAllRaw,
    reportsTimelineRaw,
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
    // TWO report reads, on purpose:
    //  - forPatient (all) feeds ONLY the citation slug-index below. Every
    //    chat-committed entity carries source_report_id → a quick-log stub;
    //    dropping stubs from the index resolves those citations to
    //    `§ unresolved:<uuid>` (breaks citation discipline / the north-star).
    //  - forTimeline (real docs only) feeds the serialized Reports section —
    //    stubs stay OUT of the AI's reading context (redundant with the entities
    //    they produced), same filter as the §6.6 timeline + rail.
    reportQueries.forPatient(patientId),
    reportQueries.forTimeline(patientId),
    journalQueries.forPatient(patientId),
    includeInsights === "none"
      ? Promise.resolve([])
      : insightQueries.forPatient(patientId),
  ]);

  const readyOrCommitted = (r: { status: string }) =>
    r.status === "ready" || r.status === "committed";
  // Slug-index population — includes stubs so source_report_id citations resolve.
  const reportsForCitation = reportsAllRaw.filter(readyOrCommitted);
  // Serialized Reports section — real documents only (stubs excluded).
  const reports = reportsTimelineRaw.filter(readyOrCommitted);
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
  // Index ALL real reports (incl. quick-log stubs) so entity source_report_id
  // citations resolve, even though only the timeline subset is serialized below.
  addAll(reportsForCitation, reportSlug);
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
    includeEntityIdDirectory
      ? serializeEntityIdDirectory(
          slugIndex,
          // Stub reports: citation-indexed above but absent from the serialized
          // Reports section — not offered as citation targets.
          new Set(
            reportsForCitation
              .filter((r) => !reports.some((t) => t.id === r.id))
              .map((r) => r.id),
          ),
        )
      : "",
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
  opts: { today?: string } = {},
): Promise<string> {
  const [medications, conditions, doctors, allergies, labs, visits, symptomTypes, symptomEpisodes] =
    await Promise.all([
      medicationQueries.forPatient(patientId),
      conditionQueries.forPatient(patientId),
      doctorQueries.forPatient(patientId),
      allergyQueries.forPatient(patientId),
      labReportQueries.forPatient(patientId),
      visitQueries.forPatient(patientId),
      symptomTypeQueries.forPatient(patientId),
      symptomEpisodeQueries.forPatient(patientId),
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

  // Recent EVENT records — for date resolution AND amendment (§6.7): a new lab
  // draw / visit is create-new, but a note can ADD to an existing one listed
  // here (a marker to a lab, a note to a visit). Bounded to the most recent
  // dozen each to stay lean — enough to resolve "the June 15 lab" without
  // dumping full history.
  const doctorNameById = new Map(doctors.map((d) => [d.id, d.name]));
  const eventSections: string[] = [];

  const recentLabs = [...labs]
    .sort((a, b) => (a.reportDate < b.reportDate ? 1 : -1))
    .slice(0, 12);
  if (recentLabs.length > 0) {
    const lines = recentLabs.map(
      (l) => `- ${l.labName ?? "Lab report"} on ${l.reportDate} (id: ${l.id})`,
    );
    eventSections.push(["## Lab reports — recent", ...lines].join("\n"));
  }

  const recentVisits = [...visits]
    .sort((a, b) => (a.visitDate < b.visitDate ? 1 : -1))
    .slice(0, 12);
  if (recentVisits.length > 0) {
    const lines = recentVisits.map((v) => {
      const doc = doctorNameById.get(v.doctorId);
      return `- Visit on ${v.visitDate}${doc ? ` with ${doc}` : ""} (id: ${v.id})`;
    });
    eventSections.push(["## Visits — recent", ...lines].join("\n"));
  }

  const symptomNameById = new Map(symptomTypes.map((t) => [t.id, t.name]));
  const recentEpisodes = [...symptomEpisodes]
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    .slice(0, 12);
  if (recentEpisodes.length > 0) {
    const lines = recentEpisodes.map((e) => {
      const name = symptomNameById.get(e.symptomTypeId) ?? "symptom";
      const date = e.startedAt.toISOString().slice(0, 10);
      const sev = e.severity ? `, ${e.severity}` : "";
      return `- ${name} on ${date}${sev} (id: ${e.id})`;
    });
    eventSections.push(["## Symptom episodes — recent", ...lines].join("\n"));
  }

  const dateHeader = opts.today
    ? [
        `Today's date is ${opts.today} (the patient's local timezone). Resolve relative or partial dates against it — "June 15th" with no year means the most recent past June 15; "yesterday" is the day before today. Still never invent a date the source doesn't imply.`,
        "",
      ]
    : [];

  if (sections.length === 0 && eventSections.length === 0) {
    return [
      "# Existing records (matching dictionary)",
      "",
      ...dateHeader,
      'No existing records yet — treat every extraction as a new entity (intent: "create").',
    ].join("\n");
  }

  const stateBlock =
    sections.length > 0
      ? [
          "These are the patient's existing match-or-create records. Use them to decide new-vs-update by clinical identity — brand vs. generic names, dose-bearing record names, spelling and transliteration variants — not exact string match. When an extraction matches one of these, set `matched_entity_id` to its id.",
          "",
          ...sections,
        ]
      : [];

  const eventBlock =
    eventSections.length > 0
      ? [
          "",
          "## Recent event records — for date resolution and amendment",
          "",
          "These recent labs, visits, and symptom episodes help you resolve dates and decide new-vs-amend. A NEW lab draw / visit / episode is always create-new — do NOT match it onto one of these. But when the note clearly ADDS TO or CORRECTS one listed here, emit `intent: \"update\"` with `matched_entity_id` set to that record's id and ONLY the added/changed fields in `extracted_data`: a lab's `results[]` to add or correct, a visit's added `notes` or corrected date/doctor/reason/summary, a symptom episode's corrected `severity` or added `notes`. When you can't tell a new record from an amendment, use `intent: \"uncertain\"` and raise the choice as an ambiguity.",
          "",
          ...eventSections,
        ]
      : [];

  return [
    "# Existing records (matching dictionary)",
    "",
    ...dateHeader,
    ...stateBlock,
    ...eventBlock,
  ].join("\n");
}
