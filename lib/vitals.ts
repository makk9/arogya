// Type-only import — erased at runtime, so the DB layer stays out of any
// client bundle importing from here (same safety as vital-options.ts).
import type { vitalReadingType } from "@/db/schema";

export type VitalReadingTypeValue = (typeof vitalReadingType.enumValues)[number];

/**
 * Compact one-line rendering of a vital reading's value — the single source for
 * both the client (`vital-options` → the `●` linked-vital pill) and the agent
 * serializer (`lib/agents/_shared/serializers/vital-reading.ts`), so the screen
 * and the prompt can never disagree (the demo relies on the AI citing a value
 * the user can actually see). Lives in `lib/` because the serializer must not
 * import from `components/` (layer boundary).
 *
 * `value_primary` + `value_secondary` keep BP as one event with two numbers
 * (§4:431); numerics round-trip as strings through Drizzle.
 */
export function formatVitalValue(reading: {
  valuePrimary: string | null;
  valueSecondary: string | null;
  unit: string;
}): string {
  const { valuePrimary, valueSecondary, unit } = reading;
  if (valuePrimary !== null && valueSecondary !== null) {
    return `${valuePrimary}/${valueSecondary} ${unit}`;
  }
  if (valuePrimary !== null) return `${valuePrimary} ${unit}`;
  return `— ${unit}`;
}

/**
 * Canonical display order + labels for reading types. Lives here (not in
 * `components/vitals/vital-options`) for the same layer reason as
 * formatVitalValue: the DB layer (entity-links vital hrefs, the dashboard's
 * recent-activity labels) and the read surfaces must agree on one wording.
 * `vital-options` re-exports these for the form selects.
 */
export const READING_TYPE_ORDER: readonly VitalReadingTypeValue[] = [
  "blood_pressure",
  "weight",
  "blood_glucose",
  "temperature",
  "heart_rate",
  "oxygen_saturation",
  "respiratory_rate",
  "other",
];

export const READING_TYPE_LABEL: Record<VitalReadingTypeValue, string> = {
  blood_pressure: "Blood pressure",
  weight: "Weight",
  blood_glucose: "Blood glucose",
  temperature: "Temperature",
  heart_rate: "Heart rate",
  oxygen_saturation: "Oxygen saturation",
  respiratory_rate: "Respiratory rate",
  other: "Other",
};

interface ReadingLike {
  readingType: VitalReadingTypeValue;
  valuePrimary: string | null;
  valueSecondary: string | null;
}

export interface ReadingTypeGroup<T> {
  type: VitalReadingTypeValue;
  /** All of the type's readings, in the caller's (newest-first) order. */
  rows: T[];
  /** Chronological numeric primary values, capped at the last `maxPoints`. */
  primaries: number[];
  /**
   * Chronological secondary values (BP diastolic), but ONLY when they pair
   * 1:1 with `primaries` — misaligned lengths would index-space two chart
   * lines against different x-steps and misstate their relation. `[]` when
   * unpaired.
   */
  secondaries: number[];
}

/**
 * Groups newest-first readings by type in canonical display order — the one
 * shape behind both the dashboard key-markers tiles and the vitals history
 * page's sections, so the trend math (chronological windowing, the
 * secondary-pairing rule) can't drift between the two surfaces.
 */
export function groupReadingsByType<T extends ReadingLike>(
  readings: T[],
  maxPoints: number,
): ReadingTypeGroup<T>[] {
  const byType = new Map<VitalReadingTypeValue, T[]>();
  for (const r of readings) {
    const list = byType.get(r.readingType);
    if (list) list.push(r);
    else byType.set(r.readingType, [r]);
  }

  const groups: ReadingTypeGroup<T>[] = [];
  for (const type of READING_TYPE_ORDER) {
    const rows = byType.get(type);
    if (!rows || rows.length === 0) continue;
    const chrono = [...rows].reverse().slice(-maxPoints);
    const numeric = chrono.filter((r) => r.valuePrimary !== null);
    const secondaries = numeric
      .filter((r) => r.valueSecondary !== null)
      .map((r) => Number(r.valueSecondary));
    groups.push({
      type,
      rows,
      primaries: numeric.map((r) => Number(r.valuePrimary)),
      secondaries: secondaries.length === numeric.length ? secondaries : [],
    });
  }
  return groups;
}
