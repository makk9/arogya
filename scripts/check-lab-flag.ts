/*
 * Smoke test for lib/labs.ts — the flag ↔ value/range derivation + contradiction
 * sanity check used by the lab form hint (and, later, the Phase-E extraction
 * confirmation screen). Pure, no DB. Run: npm run lab-flag:check
 */
import { deriveFlag, flagContradictsRange } from "../lib/labs";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? "✅" : "❌"} ${name} — got ${JSON.stringify(actual)}${ok ? "" : `, expected ${JSON.stringify(expected)}`}`);
}

// --- deriveFlag ---
check("above high → high", deriveFlag(1.5, 0.7, 1.3), "high");
check("below low → low", deriveFlag(0.5, 0.7, 1.3), "low");
check("in range → normal", deriveFlag(1.0, 0.7, 1.3), "normal");
check("eGFR 50 (≥60) → low", deriveFlag(50, 60, null), "low");
check("eGFR 70 (≥60) → normal", deriveFlag(70, 60, null), "normal");
check("LDL 112 (≤100) → high", deriveFlag(112, null, 100), "high");
check("LDL 95 (≤100) → normal", deriveFlag(95, null, 100), "normal");
check("string inputs parse → high", deriveFlag("1.5", "0.7", "1.3"), "high");
check("no value → null", deriveFlag(null, 0.7, 1.3), null);
check("no range → null", deriveFlag(1.5, null, null), null);
check("empty strings → null", deriveFlag("", "", ""), null);
check("non-numeric value → null", deriveFlag("positive", 0.7, 1.3), null);
check("boundary low inclusive → normal", deriveFlag(0.7, 0.7, 1.3), "normal");
check("boundary high inclusive → normal", deriveFlag(1.3, 0.7, 1.3), "normal");

// --- flagContradictsRange ---
check("high flag + high value → agree (no warn)", flagContradictsRange("high", 1.5, 0.7, 1.3), false);
check("normal flag + high value → contradiction", flagContradictsRange("normal", 1.5, 0.7, 1.3), true);
check("high flag + in-range value → contradiction", flagContradictsRange("high", 1.0, 0.7, 1.3), true);
check("low flag + high value → contradiction", flagContradictsRange("low", 1.5, 0.7, 1.3), true);
check("critical never second-guessed", flagContradictsRange("critical", 1.0, 0.7, 1.3), false);
check("unset flag → no opinion", flagContradictsRange("", 1.5, 0.7, 1.3), false);
check("null flag → no opinion", flagContradictsRange(null, 1.5, 0.7, 1.3), false);
check("flag set but no range → no opinion", flagContradictsRange("high", 1.5, null, null), false);
check("string value agrees → false", flagContradictsRange("high", "1.5", "0.7", "1.3"), false);

console.log(failures === 0 ? "\n✓ All lab-flag assertions passed." : `\n✗ ${failures} failure(s).`);
process.exit(failures === 0 ? 0 : 1);
