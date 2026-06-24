/*
 * Smoke test for lib/units.ts — proves the imperial conversion path that v1's
 * single (India) patient can't exercise in the browser. Run: npm run units:check
 */
import {
  formatHeight,
  formatWeight,
  heightEditValue,
  parseHeightToCm,
  parseWeightToKg,
  unitSystemForCountry,
  weightEditValue,
} from "../lib/units";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? "✅" : "❌"} ${name} — got ${JSON.stringify(actual)}${ok ? "" : `, expected ${JSON.stringify(expected)}`}`);
}

// --- country inference ---
check("India → metric", unitSystemForCountry("India"), "metric");
check("United States → imperial", unitSystemForCountry("United States"), "imperial");
check("USA (case-insensitive) → imperial", unitSystemForCountry("usa"), "imperial");
check("null → metric (safe default)", unitSystemForCountry(null), "metric");
check("unknown country → metric", unitSystemForCountry("Atlantis"), "metric");

// --- height display ---
check("172cm metric", formatHeight("172", "metric"), "172 cm");
check("172cm imperial (≈5ft8)", formatHeight("172", "imperial"), "5 ft 8 in");
check("180cm imperial (≈5ft11)", formatHeight("180", "imperial"), "5 ft 11 in");
check("182cm imperial carries to 6ft0", formatHeight("182.9", "imperial"), "6 ft 0 in");
check("empty height → null", formatHeight(null, "imperial"), null);

// --- height parse (→ canonical cm) ---
check("metric '172' → 172", parseHeightToCm("172", "metric"), "172");
check("imperial '5 ft 8 in' → 173", parseHeightToCm("5 ft 8 in", "imperial"), "172.7");
check("imperial \"5'8\\\"\" → 172.7", parseHeightToCm("5' 8\"", "imperial"), "172.7");
check("imperial bare inches '68' → 172.7", parseHeightToCm("68", "imperial"), "172.7");
check("garbage → null", parseHeightToCm("tall", "imperial"), null);

// --- weight display + parse ---
check("70kg metric", formatWeight("70", "metric"), "70 kg");
check("70kg imperial (≈154lb)", formatWeight("70", "imperial"), "154 lb");
check("metric '70' → 70", parseWeightToKg("70", "metric"), "70");
check("imperial '154' → 69.9kg", parseWeightToKg("154", "imperial"), "69.9");
check("negative → null", parseWeightToKg("-5", "metric"), null);

// --- edit-seed values (bare, unit-word-free; must round-trip through parse) ---
check("height edit metric '172'", heightEditValue("172", "metric"), "172");
check("height edit imperial '5 ft 8 in'", heightEditValue("172", "imperial"), "5 ft 8 in");
check("weight edit metric '70'", weightEditValue("70", "metric"), "70");
check("weight edit imperial '154'", weightEditValue("70", "imperial"), "154");
check("edit seed null → ''", heightEditValue(null, "imperial"), "");

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
