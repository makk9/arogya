/**
 * Builders for the chat surface-context string — the human-readable hint the
 * synthesis agent biases toward (design.md 5.3 + 6.4:1354). The string is the
 * *inner* text only; `buildVaultContext` (lib/agents/_shared/vault-context.ts:227)
 * wraps it in `<surface_context>…</surface_context>` before it reaches the model.
 *
 * Pure functions, no DB: the floating Ask AI button lives on pages that already
 * hold the entity they're describing, so each surface builds its own string and
 * passes it to the button. The drawer then sends it alongside each message.
 *
 * Voice per 7.1: plain, names the entity, no AI throat-clearing.
 */

export const MEDICATIONS_LIST_SURFACE = "The user is viewing the full list of medications.";

export const CONDITIONS_LIST_SURFACE = "The user is viewing the full list of conditions.";

export const DOCTORS_LIST_SURFACE = "The user is viewing the full list of doctors.";

export const ALLERGIES_LIST_SURFACE = "The user is viewing the full list of allergies.";

export const FAMILY_HISTORY_LIST_SURFACE =
  "The user is viewing the full list of family medical history entries.";

// Singleton — no per-entity identifiers to interpolate; the vault context
// already carries the full profile.
export const LIFESTYLE_SURFACE =
  "The user is viewing the patient's lifestyle profile (diet, exercise, sleep, stress, tobacco, alcohol).";

export const VISITS_LIST_SURFACE =
  "The user is viewing the visits timeline (all doctor visits).";

export const LABS_LIST_SURFACE =
  "The user is viewing the lab reports timeline (all lab reports and their markers).";

export const SYMPTOMS_LIST_SURFACE =
  "The user is viewing the symptoms timeline (symptom types grouped with their episodes).";

export const REPORTS_LIST_SURFACE =
  "The user is viewing the reports timeline (all uploaded documents — discharge summaries, doctor letters, prescriptions, imaging, etc.).";

export const JOURNAL_LIST_SURFACE =
  "The user is viewing the journal timeline (their own free-form dated notes about the patient).";

export function symptomTypeSurfaceContext(type: {
  name: string;
  status: string;
  episodeCount: number;
}): string {
  const episodes =
    type.episodeCount > 0
      ? ` (${type.episodeCount} ${type.episodeCount === 1 ? "episode" : "episodes"} logged)`
      : "";
  return `The user is viewing the symptom record for ${type.name}, currently ${type.status}${episodes}.`;
}

export function symptomEpisodeSurfaceContext(episode: {
  symptomTypeName: string;
  startedAt: string;
  severity: string | null;
}): string {
  const severityNote = episode.severity ? `, ${episode.severity}` : "";
  return `The user is viewing a ${episode.symptomTypeName} episode from ${episode.startedAt}${severityNote}.`;
}

export function labReportSurfaceContext(report: {
  reportDate: string;
  reportType: string | null;
  labName: string | null;
  flaggedCount: number;
}): string {
  const what = report.reportType ?? report.labName ?? "lab report";
  const flagged =
    report.flaggedCount > 0
      ? ` (${report.flaggedCount} flagged marker${report.flaggedCount === 1 ? "" : "s"})`
      : "";
  return `The user is viewing the ${what} from ${report.reportDate}${flagged}.`;
}

export function visitSurfaceContext(visit: {
  visitDate: string;
  doctorName: string | null;
  status: string;
}): string {
  const who = visit.doctorName ? ` with ${visit.doctorName}` : "";
  const framing = visit.status === "scheduled" ? "upcoming " : "";
  return `The user is viewing the ${framing}visit${who} on ${visit.visitDate}.`;
}

export function reportSurfaceContext(report: {
  title: string;
  reportType: string | null;
  reportDate: string;
}): string {
  const typeNote = report.reportType ? ` (${report.reportType})` : "";
  return `The user is viewing the report "${report.title}"${typeNote} dated ${report.reportDate}.`;
}

export function journalSurfaceContext(entry: {
  title: string | null;
  entryDate: string;
  mood: string | null;
}): string {
  const titled = entry.title ? `"${entry.title}"` : "an untitled entry";
  const moodNote = entry.mood ? `, mood ${entry.mood}` : "";
  return `The user is viewing the journal entry ${titled} from ${entry.entryDate}${moodNote}.`;
}

export function familyHistorySurfaceContext(entry: {
  relation: string;
  relationSpecific: string | null;
  conditionName: string;
}): string {
  const who = entry.relationSpecific ?? entry.relation;
  return `The user is viewing the family history entry for ${who}: ${entry.conditionName}.`;
}

export function medicationSurfaceContext(medication: {
  name: string;
  currentDose: string;
  currentFrequency: string;
  status: string;
}): string {
  return `The user is viewing the medication record for ${medication.name} (${medication.currentDose}, ${medication.currentFrequency}), currently ${medication.status}.`;
}

export function conditionSurfaceContext(condition: {
  name: string;
  status: string;
  severity: string | null;
}): string {
  const severityNote = condition.severity ? `, ${condition.severity}` : "";
  return `The user is viewing the condition record for ${condition.name}, currently ${condition.status}${severityNote}.`;
}

export function allergySurfaceContext(allergy: {
  substance: string;
  category: string;
  status: string;
  severity: string | null;
}): string {
  const severityNote =
    allergy.severity && allergy.severity !== "unknown"
      ? `, ${allergy.severity}`
      : "";
  return `The user is viewing the allergy record for ${allergy.substance} (${allergy.category}), currently ${allergy.status}${severityNote}.`;
}

export function doctorSurfaceContext(doctor: {
  name: string;
  specialty: string;
  clinic: string | null;
}): string {
  const clinicNote = doctor.clinic ? ` at ${doctor.clinic}` : "";
  return `The user is viewing the record for ${doctor.name} (${doctor.specialty}${clinicNote}).`;
}
