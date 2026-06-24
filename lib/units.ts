/*
 * Measurement unit handling for the patient profile (design.md 6.10:1678).
 *
 * The schema stores canonical metric (`patients.height_cm`,
 * `current_weight_kg`) — units are a display/input concern only. Rather than
 * assume metric (or imperial), the displayed system is *derived* from the
 * patient's country, which §4:241 already treats as load-bearing ("affects
 * lab reference ranges, drug names"). The demo patient (India) renders metric;
 * a US patient renders ft-in / lb. v1 is single-patient, so the imperial path
 * isn't browser-reachable — its math is covered by scripts/check-units.ts.
 *
 * Pure functions, no DB: safe in both server components and the client bundle.
 */

export type UnitSystem = "metric" | "imperial";

// The practical imperial case is the US; Liberia + Myanmar are the other two
// customary-system holdouts, included so the inference is honest rather than
// US-only. Everything else (incl. an unknown/empty country) is metric — the
// safe global default. Matched case-insensitively against a few common spellings.
const IMPERIAL_COUNTRIES = new Set([
  "united states",
  "united states of america",
  "usa",
  "us",
  "u.s.",
  "u.s.a.",
  "america",
  "liberia",
  "myanmar",
  "burma",
]);

export function unitSystemForCountry(country: string | null): UnitSystem {
  if (!country) return "metric";
  return IMPERIAL_COUNTRIES.has(country.trim().toLowerCase())
    ? "imperial"
    : "metric";
}

const CM_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;
const KG_PER_LB = 0.453_592_37;

function round(n: number, places = 1): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

// ---- Height (canonical cm) ----

/** "172 cm" or "5 ft 8 in". Input is the stored cm string; null/empty → null. */
export function formatHeight(cm: string | null, system: UnitSystem): string | null {
  if (!cm) return null;
  const n = Number(cm);
  if (!Number.isFinite(n)) return null;
  if (system === "metric") return `${round(n)} cm`;
  const totalInches = n / CM_PER_INCH;
  const feet = Math.floor(totalInches / INCHES_PER_FOOT);
  const inches = Math.round(totalInches - feet * INCHES_PER_FOOT);
  // Carry a rounded-up 12" into the next foot (e.g. 11.6" → 1 ft).
  if (inches === INCHES_PER_FOOT) return `${feet + 1} ft 0 in`;
  return `${feet} ft ${inches} in`;
}

/**
 * Parse a user-typed height into canonical cm (string, to match the numeric
 * column's text round-trip). Metric: a plain number of cm. Imperial: accepts
 * `5 ft 8 in`, `5' 8"`, `5'8`, or a bare number of inches. Returns null when
 * unparseable so the caller can surface a field error.
 */
export function parseHeightToCm(input: string, system: UnitSystem): string | null {
  const s = input.trim();
  if (!s) return null;
  if (system === "metric") {
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? String(round(n)) : null;
  }
  // Imperial: pull feet + inches from the various notations.
  const ftInMatch = s.match(/^(\d+(?:\.\d+)?)\s*(?:ft|feet|')\s*(\d+(?:\.\d+)?)?\s*(?:in|inch|inches|")?$/i);
  if (ftInMatch) {
    const feet = Number(ftInMatch[1]);
    const inches = ftInMatch[2] ? Number(ftInMatch[2]) : 0;
    const cm = (feet * INCHES_PER_FOOT + inches) * CM_PER_INCH;
    return cm > 0 ? String(round(cm)) : null;
  }
  // Bare number → treat as inches.
  const bare = Number(s);
  if (Number.isFinite(bare) && bare > 0) return String(round(bare * CM_PER_INCH));
  return null;
}

export function heightPlaceholder(system: UnitSystem): string {
  return system === "metric" ? "cm" : "e.g. 5 ft 8 in";
}

/**
 * The bare, unit-word-free string to seed an edit input with (so a blur can
 * re-parse it): metric → "172"; imperial → "5 ft 8 in" (parseable by
 * parseHeightToCm). Empty string for a null value.
 */
export function heightEditValue(cm: string | null, system: UnitSystem): string {
  if (!cm) return "";
  if (system === "metric") {
    const n = Number(cm);
    return Number.isFinite(n) ? String(round(n)) : "";
  }
  return formatHeight(cm, "imperial") ?? "";
}

// ---- Weight (canonical kg) ----

/** "70 kg" or "154 lb". Input is the stored kg string; null/empty → null. */
export function formatWeight(kg: string | null, system: UnitSystem): string | null {
  if (!kg) return null;
  const n = Number(kg);
  if (!Number.isFinite(n)) return null;
  if (system === "metric") return `${round(n)} kg`;
  return `${Math.round(n / KG_PER_LB)} lb`;
}

/** Parse a user-typed weight into canonical kg (string). null when unparseable. */
export function parseWeightToKg(input: string, system: UnitSystem): string | null {
  const s = input.trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return system === "metric" ? String(round(n)) : String(round(n * KG_PER_LB));
}

export function weightPlaceholder(system: UnitSystem): string {
  return system === "metric" ? "kg" : "lb";
}

/** Bare edit-seed for weight: metric → "70"; imperial → "154". "" for null. */
export function weightEditValue(kg: string | null, system: UnitSystem): string {
  if (!kg) return "";
  const n = Number(kg);
  if (!Number.isFinite(n)) return "";
  return system === "metric" ? String(round(n)) : String(Math.round(n / KG_PER_LB));
}
