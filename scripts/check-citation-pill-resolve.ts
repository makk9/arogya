/**
 * Round-trip test for the medication citation-pill resolve pipeline (Phase C
 * item 7). Walks the exact path a chat pill travels:
 *
 *   medicationSlug(med)  →  "§ med:<slug>" rendered in chat
 *     → tokenizeCitations() parses it back to { entityType:"med", slug }
 *       → bySlug match (slugify(name) === slug) resolves to the same med
 *
 * The point isn't to re-prove slugify is idempotent — it's to catch real
 * medication-name edge cases (apostrophes, parentheses, casing, accents) where
 * the emitted slug could fail to parse or fail to resolve. A name that slugifies
 * to characters the tokenizer regex rejects would silently produce a dead pill;
 * this asserts that never happens for the fixture names.
 *
 * Pure (no env, no DB): the resolver's match logic is replicated inline over an
 * in-memory array, identical to medicationQueries.bySlug.
 *
 * Run via: npm run citation-resolve:check
 */

import type { Medication } from "../db/schema";
import { slugify } from "../lib/agents/_shared/serializers/format";
import { medicationSlug } from "../lib/agents/_shared/serializers/medication";
import { tokenizeCitations } from "../lib/citations/parse";

type FakeMed = Pick<Medication, "id" | "name">;

// Distinct slugs (no collisions) so each round-trips to exactly one med. The
// names probe the edge cases that break naive slug handling.
const meds: readonly FakeMed[] = [
  { id: "00000000-0000-0000-0000-000000000001", name: "Amlodipine" },
  { id: "00000000-0000-0000-0000-000000000002", name: "Lo'Loestrin Fe" },
  { id: "00000000-0000-0000-0000-000000000003", name: "Lipitor (atorvastatin)" },
  { id: "00000000-0000-0000-0000-000000000004", name: "METFORMIN" },
  { id: "00000000-0000-0000-0000-000000000005", name: "Lévothyrox" },
];

// Mirror of medicationQueries.bySlug's match step.
function resolveBySlug(slug: string): FakeMed | null {
  return meds.find((m) => slugify(m.name) === slug) ?? null;
}

function run(): void {
  let failures = 0;

  for (const med of meds) {
    // 1. Serializer emits the pill text.
    const rendered = `§ ${medicationSlug(med as Medication)}`;

    // 2. Parser tokenizes it back.
    const tokens = tokenizeCitations(rendered);
    const vault = tokens.find((t) => t.kind === "vault");

    if (!vault || vault.kind !== "vault") {
      console.error(`[${med.name}] did not parse to a vault citation: "${rendered}"`);
      failures += 1;
      continue;
    }
    if (vault.entityType !== "med") {
      console.error(`[${med.name}] entityType "${vault.entityType}" ≠ "med"`);
      failures += 1;
      continue;
    }
    if (vault.slug === null) {
      console.error(`[${med.name}] parsed slug is null for "${rendered}"`);
      failures += 1;
      continue;
    }

    // 3. Resolver matches the parsed slug back to the original med.
    const resolved = resolveBySlug(vault.slug);
    const ok = resolved?.id === med.id;
    console.log(`[${med.name} → "${rendered}"] ${ok ? "✓" : "✗"}`);
    if (!ok) {
      console.error(`  expected id ${med.id}, got ${resolved?.id ?? "null"}`);
      failures += 1;
    }
  }

  // Unknown slug resolves to null (drives the popover's "not in the record"
  // state) rather than throwing or mismatching.
  const missing = resolveBySlug("nonexistent-medication");
  const missOk = missing === null;
  console.log(`[unknown slug → null] ${missOk ? "✓" : "✗"}`);
  if (!missOk) failures += 1;

  const total = meds.length + 1;
  if (failures > 0) {
    console.error(`\ncitation-pill-resolve FAILED: ${failures}/${total} case(s)`);
    process.exit(1);
  }
  console.log(`\n✓ All ${total} citation-pill-resolve assertions passed.`);
}

run();
