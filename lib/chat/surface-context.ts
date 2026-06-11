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
