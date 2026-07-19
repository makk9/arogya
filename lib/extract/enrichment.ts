import {
  allergyCategory,
  allergySeverity,
  conditionCategory,
  conditionSeverity,
  medicationCategory,
  medicationForm,
  symptomBodyArea,
  symptomEpisodeSeverity,
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
    { key: "severity", label: "severity", kind: "select", options: allergySeverity.enumValues },
    { key: "category", label: "category", kind: "select", options: allergyCategory.enumValues },
    { key: "notes", label: "notes", kind: "text" },
  ],
  lab_report: [
    { key: "report_type", label: "report type", kind: "text" },
    { key: "notes", label: "notes", kind: "text" },
  ],
  vital_reading: [{ key: "notes", label: "notes", kind: "text" }],
  visit: [
    { key: "visit_type", label: "visit type", kind: "select", options: visitType.enumValues },
    { key: "reason", label: "reason", kind: "text" },
    { key: "summary", label: "summary", kind: "text" },
    { key: "notes", label: "notes", kind: "text" },
  ],
  symptom_episode: [
    { key: "severity", label: "severity", kind: "select", options: symptomEpisodeSeverity.enumValues },
    { key: "body_area", label: "body area", kind: "select", options: symptomBodyArea.enumValues },
    { key: "notes", label: "notes", kind: "text" },
  ],
};
