/**
 * Display helpers for doctor identity, shared by server and client components
 * (pure string functions, no DB edge — safe in the client bundle).
 *
 * Phase 4 stores `name` as given ("Dr. Sharma" or "Priya Sharma"), while the
 * §6.4/§6.5 sketches render a uniform "Dr " prefix. Surfaces that previously
 * hardcoded `Dr ${name}` would render "Dr Dr. Sharma" for honorific-included
 * names — every doctor-name render goes through displayDoctorName instead.
 */

const HONORIFIC = /^dr\.?\s+/i;

/** "Priya Sharma" → "Dr Priya Sharma"; "Dr. Sharma" → "Dr. Sharma" (as given). */
export function displayDoctorName(name: string): string {
  const trimmed = name.trim();
  if (HONORIFIC.test(trimmed)) return trimmed;
  return `Dr ${trimmed}`;
}

/**
 * Initials for the avatar circle (§6.4 doctor card, §6.5 prominent card).
 * Honorific is stripped first so "Dr. Priya Sharma" → "PS". Single-word names
 * yield one letter; empty names fall back to "D"(octor).
 */
export function doctorInitials(name: string): string {
  const words = name.trim().replace(HONORIFIC, "").split(/\s+/).filter(Boolean);
  const letters = words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return letters || "D";
}

/**
 * Mask a phone number at rest per §6.5:1414 (`+91 98XXX XX140`): keep the
 * first 4 and last 3 digits, X the rest, preserving non-digit formatting.
 * Short numbers degrade gracefully (≤7 digits → keep last 3 only; ≤3 → all X).
 * Sensitive-data treatment to revisit in Phase 9 — the raw value still renders
 * in the inline-edit input, which is deliberate (you can't correct what you
 * can't see).
 */
export function maskPhone(phone: string): string {
  const digitCount = (phone.match(/\d/g) ?? []).length;
  const keepFront = digitCount > 7 ? 4 : 0;
  const keepBack = digitCount > 3 ? 3 : 0;
  let seen = 0;
  let out = "";
  for (const ch of phone) {
    if (!/\d/.test(ch)) {
      out += ch;
      continue;
    }
    seen += 1;
    out += seen <= keepFront || seen > digitCount - keepBack ? ch : "X";
  }
  return out;
}
