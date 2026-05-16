/**
 * Unit tests for the citation tokenizer (lib/citations/parse.ts).
 *
 * No env gating; the tokenizer is pure. Asserts the 9 fixture cases that lock
 * the parsed-shape contract, plus a round-trip case against the serializer-side
 * `citationFor()` to keep the two halves of the citation pipeline in sync.
 *
 * Run via: npm run citation-parser:check
 */

import {
  tokenizeCitations,
  type CitationSegment,
} from "../lib/citations/parse";
import { citationFor } from "../lib/agents/_shared/serializers/format";

interface Case {
  readonly label: string;
  readonly input: string;
  readonly expected: CitationSegment[];
}

const cases: readonly Case[] = [
  {
    label: "plain-text",
    input: "plain text",
    expected: [{ kind: "text", text: "plain text" }],
  },
  {
    label: "vault-inline",
    input: "with § med:amlodipine inline",
    expected: [
      { kind: "text", text: "with " },
      {
        kind: "vault",
        entityType: "med",
        slug: "amlodipine",
        raw: "§ med:amlodipine",
      },
      { kind: "text", text: " inline" },
    ],
  },
  {
    label: "vault-type-only",
    input: "type-only § symptom-log here",
    expected: [
      { kind: "text", text: "type-only " },
      {
        kind: "vault",
        entityType: "symptom-log",
        slug: null,
        raw: "§ symptom-log",
      },
      { kind: "text", text: " here" },
    ],
  },
  {
    label: "vault-spaced-colon",
    input: "spaced § med: amlodipine variant",
    expected: [
      { kind: "text", text: "spaced " },
      {
        kind: "vault",
        entityType: "med",
        slug: "amlodipine",
        raw: "§ med: amlodipine",
      },
      { kind: "text", text: " variant" },
    ],
  },
  {
    label: "vault-date-suffix",
    input: "date suffix § symptom: dizziness/apr-6",
    expected: [
      { kind: "text", text: "date suffix " },
      {
        kind: "vault",
        entityType: "symptom",
        slug: "dizziness/apr-6",
        raw: "§ symptom: dizziness/apr-6",
      },
    ],
  },
  {
    label: "external-in-parens",
    input: "external (↗ JNC-8 hypertension guidelines).",
    expected: [
      { kind: "text", text: "external (" },
      {
        kind: "external",
        sourceName: "JNC-8 hypertension guidelines",
        raw: "↗ JNC-8 hypertension guidelines",
      },
      { kind: "text", text: ")." },
    ],
  },
  {
    label: "multiple-mixed",
    input: "multiple § med:amlodipine and ↗ source one ↗ source two.",
    expected: [
      { kind: "text", text: "multiple " },
      {
        kind: "vault",
        entityType: "med",
        slug: "amlodipine",
        raw: "§ med:amlodipine",
      },
      { kind: "text", text: " and " },
      { kind: "external", sourceName: "source one", raw: "↗ source one" },
      { kind: "text", text: " " },
      { kind: "external", sourceName: "source two", raw: "↗ source two" },
      { kind: "text", text: "." },
    ],
  },
  {
    label: "empty",
    input: "",
    expected: [],
  },
  {
    label: "lone-glyph",
    input: "§",
    expected: [{ kind: "text", text: "§" }],
  },
];

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function run(): void {
  console.log("Running citation tokenizer unit tests...\n");

  let failures = 0;
  for (const c of cases) {
    const actual = tokenizeCitations(c.input);
    const ok = deepEqual(actual, c.expected);
    console.log(`[${c.label}] ${ok ? "✓" : "✗"}`);
    if (!ok) {
      console.log("  expected:", JSON.stringify(c.expected));
      console.log("  actual:  ", JSON.stringify(actual));
      failures += 1;
    }
  }

  // Round-trip: every string citationFor() emits must tokenize back to a vault
  // segment with the matching entity-type:slug. Locks the parser↔serializer
  // contract — if the serializer's pill format changes, this test fails loudly.
  //
  // Two cases: resolved (id found in slug index) and unresolved (id missing,
  // serializer falls back to "§ unresolved:{uuid}"). Both paths emit strings
  // that flow into synthesis output via the vault context, so both must parse.
  console.log("\nRound-trip against citationFor()...\n");

  const id = "1ab39e3a-2c1f-4a3a-9b1f-1c4f8e7a2b1d";

  // Both round-trip cases produce vault citations; narrow the fixture type
  // so the `{ ...expected, raw }` spread below doesn't fight the wider union.
  type VaultSegment = Extract<CitationSegment, { kind: "vault" }>;
  const roundTripCases: ReadonlyArray<{
    label: string;
    slugIndex: Map<string, string>;
    expected: Omit<VaultSegment, "raw">;
  }> = [
    {
      label: "resolved",
      slugIndex: new Map([[id, "med:amlodipine"]]),
      expected: { kind: "vault", entityType: "med", slug: "amlodipine" },
    },
    {
      label: "unresolved",
      slugIndex: new Map(),
      expected: { kind: "vault", entityType: "unresolved", slug: id },
    },
  ];

  for (const rt of roundTripCases) {
    const emitted = citationFor(id, rt.slugIndex);
    if (emitted === null) {
      console.error(`[round-trip ${rt.label}] citationFor returned null`);
      failures += 1;
      continue;
    }
    const tokens = tokenizeCitations(emitted);
    const expected: CitationSegment[] = [{ ...rt.expected, raw: emitted }];
    const ok = deepEqual(tokens, expected);
    console.log(`[round-trip ${rt.label} "${emitted}"] ${ok ? "✓" : "✗"}`);
    if (!ok) {
      console.log("  expected:", JSON.stringify(expected));
      console.log("  actual:  ", JSON.stringify(tokens));
      failures += 1;
    }
  }

  const total = cases.length + roundTripCases.length;
  if (failures > 0) {
    console.error(`\ncitation-parser FAILED: ${failures}/${total} case(s)`);
    process.exit(1);
  }
  console.log(`\n✓ All ${total} citation-parser assertions passed.`);
}

run();
