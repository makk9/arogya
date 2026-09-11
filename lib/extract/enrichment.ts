import {
  allergyCategory,
  allergySeverity,
  allergyStatus,
  conditionCategory,
  conditionSeverity,
  conditionStatus,
  medicationCategory,
  medicationForm,
  medicationStatus,
  symptomBodyArea,
  symptomEpisodeSeverity,
  vitalContext,
  vitalReadingType,
  visitType,
} from "@/db/schema";
import type { CommitEntityType } from "@/lib/schemas/api/extract-commit";

/**
 * Per-entity "worth capturing" optional fields — the guided-scribe discoverability
 * layer (decisions.md 2026-07-17). The E3 confirmation card surfaces the ones a
 * given card hasn't already filled as inline "add" chips, so the user can enrich a
 * sparse log (e.g. a bare "osteoporosis") without the manual-form detour. NEVER
 * pre-filled by the agent — this only surfaces what the USER can add.
 *
 * Scope rules:
 *  - Only fields the commit CREATE mapper actually persists (so an added value
 *    round-trips). Keys are the agent's snake_case names (§5.4:763).
 *  - Enum options come from the real pgEnum `enumValues` — never a hand-copied
 *    list (that drift caused the 2026-07-14 medication-form OTC/other bug).
 *  - Doctor-link FK fields (diagnosed_by / managing_doctor / prescribing_doctor /
 *    ordering_doctor) are DEFERRED — they need the doctor-picker carryover.
 *
 * This module imports pgEnums (runtime values) so it is server-only; the E3 page
 * passes the plain-data config to the client card as a prop.
 */
export interface EnrichmentField {
  key: string;
  label: string;
  kind: "text" | "select" | "date";
  options?: readonly string[];
}

export const ENRICHMENT_FIELDS: Record<CommitEntityType, readonly EnrichmentField[]> = {
  medication: [
    { key: "brand_name", label: "brand name", kind: "text" },
    { key: "category", label: "category", kind: "select", options: medicationCategory.enumValues },
    { key: "form", label: "form", kind: "select", options: medicationForm.enumValues },
    { key: "started_on", label: "started on", kind: "date" },
    { key: "purpose", label: "purpose", kind: "text" },
    { key: "notes", label: "notes", kind: "text" },
  ],
  condition: [
    { key: "severity", label: "severity", kind: "select", options: conditionSeverity.enumValues },
    { key: "category", label: "category", kind: "select", options: conditionCategory.enumValues },
    { key: "diagnosed_on", label: "diagnosed on", kind: "date" },
    { key: "notes", label: "notes", kind: "text" },
  ],
  doctor: [{ key: "notes", label: "notes", kind: "text" }],
  allergy: [
    { key: "reaction", label: "reaction", kind: "text" },
    { key: "first_noted", label: "first noted", kind: "date" },
    { key: "severity", label: "severity", kind: "select", options: allergySeverity.enumValues },
    { key: "category", label: "category", kind: "select", options: allergyCategory.enumValues },
    { key: "notes", label: "notes", kind: "text" },
  ],
  lab_report: [
    { key: "report_type", label: "report type", kind: "text" },
    { key: "notes", label: "notes", kind: "text" },
  ],
  vital_reading: [
    { key: "context", label: "context", kind: "select", options: vitalContext.enumValues },
    { key: "notes", label: "notes", kind: "text" },
  ],
  visit: [
    { key: "visit_type", label: "visit type", kind: "select", options: visitType.enumValues },
    { key: "reason", label: "reason", kind: "text" },
    { key: "summary", label: "summary", kind: "text" },
    { key: "diagnosis_text", label: "diagnosis", kind: "text" },
    { key: "next_steps", label: "next steps", kind: "text" },
    { key: "notes", label: "notes", kind: "text" },
  ],
  symptom_episode: [
    { key: "severity", label: "severity", kind: "select", options: symptomEpisodeSeverity.enumValues },
    { key: "body_area", label: "body area", kind: "select", options: symptomBodyArea.enumValues },
    { key: "description", label: "what it felt like", kind: "text" },
    { key: "triggers", label: "triggers", kind: "text" },
    { key: "relief", label: "what helped", kind: "text" },
    { key: "duration_minutes", label: "duration (min)", kind: "text" },
    { key: "notes", label: "notes", kind: "text" },
  ],
};

/**
 * Every agent-facing key whose value is a closed pgEnum, per entity type — the
 * single source of truth for "what values may this field hold", shared by the
 * two places that need it:
 *
 *  - the extraction prompt, which renders these lists so the agent classifies
 *    into real enum members (and offers ambiguity `options` that are members);
 *  - the E3 confirmation card, which drops any ambiguity option the enum
 *    doesn't contain and falls back to a picker of the real values.
 *
 * Keys are the agent's snake_case names (§5.4:763) and the set matches what the
 * commit mapper actually reads through `enumMember` — an option outside these
 * lists is silently dropped at commit, which is the failure this map exists to
 * prevent. Values come from `enumValues`, never a hand-copied list (the same
 * rule as ENRICHMENT_FIELDS; hand-copying caused the 2026-07-14 medication-form
 * OTC/other bug). `lab_report.results[].flag` is deliberately absent — it lives
 * inside the results array, not at the top level where an ambiguity can target it.
 */
export const ENUM_FIELD_VALUES: Record<
  CommitEntityType,
  Readonly<Record<string, readonly string[]>>
> = {
  medication: {
    category: medicationCategory.enumValues,
    form: medicationForm.enumValues,
    status: medicationStatus.enumValues,
  },
  condition: {
    status: conditionStatus.enumValues,
    severity: conditionSeverity.enumValues,
    category: conditionCategory.enumValues,
  },
  doctor: {},
  allergy: {
    category: allergyCategory.enumValues,
    severity: allergySeverity.enumValues,
    status: allergyStatus.enumValues,
  },
  lab_report: {},
  vital_reading: {
    type: vitalReadingType.enumValues,
    context: vitalContext.enumValues,
  },
  visit: { visit_type: visitType.enumValues },
  symptom_episode: {
    body_area: symptomBodyArea.enumValues,
    severity: symptomEpisodeSeverity.enumValues,
  },
};
