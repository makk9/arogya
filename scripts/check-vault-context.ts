import { STUB_PATIENT_ID } from "../lib/auth";
import { buildVaultContext } from "../lib/agents/_shared/vault-context";

const FIXED_NOW = new Date("2026-05-13T12:00:00.000Z");

function assert(condition: unknown, message: string): void {
  if (!condition) {
    console.error(`ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

async function main() {
  const runA = await buildVaultContext(STUB_PATIENT_ID, {}, FIXED_NOW);
  const runB = await buildVaultContext(STUB_PATIENT_ID, {}, FIXED_NOW);

  assert(runA.length > 0, "output is non-empty");
  assert(
    runA.startsWith("# Patient"),
    "output starts with the Patient section",
  );
  assert(
    runA.includes("Relangi Mavayya"),
    "output contains the seeded patient name",
  );
  assert(
    /Date of birth: \d{4}-\d{2}-\d{2}/.test(runA),
    "DOB rendered as ISO YYYY-MM-DD",
  );
  assert(
    /\(age \d+ as of \d{4}-\d{2}-\d{2}\)/.test(runA),
    "age computed against the fixed now",
  );
  assert(
    runA === runB,
    "two runs with identical state and same now produce byte-identical output",
  );

  // Brief-exclusion regression assertion per Phase 10.1:2948 DoD.
  // In v1 there is no Brief entity, so flipping the flag must be a no-op. When
  // Brief lands in v1.5 this assertion will fail loudly if the exclusion rule is
  // ever forgotten — exactly what 10.1 asks the test to catch.
  const briefsExcluded = await buildVaultContext(
    STUB_PATIENT_ID,
    { excludeBriefs: true },
    FIXED_NOW,
  );
  const briefsIncluded = await buildVaultContext(
    STUB_PATIENT_ID,
    { excludeBriefs: false },
    FIXED_NOW,
  );
  assert(
    briefsExcluded === briefsIncluded,
    "excludeBriefs flag is a no-op in v1 (no Brief entity exists)",
  );

  console.log("vault-context: all assertions passed");
  console.log("--- output ---");
  console.log(runA);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
