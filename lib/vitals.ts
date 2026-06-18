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
