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

export function medicationSurfaceContext(medication: {
  name: string;
  currentDose: string;
  currentFrequency: string;
  status: string;
}): string {
  return `The user is viewing the medication record for ${medication.name} (${medication.currentDose}, ${medication.currentFrequency}), currently ${medication.status}.`;
}
