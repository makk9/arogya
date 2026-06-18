/**
 * Sentinel value for an optional Base UI / shadcn `Select`: the component cannot
 * hold an empty-string value, so the "no value chosen" row carries this instead;
 * form submit handlers coerce it back to `undefined` (→ the server stores null).
 *
 * Single source of truth — the per-entity option modules (`condition-options`,
 * `symptom-options`, …) re-export it so existing import paths keep working while
 * the literal lives in exactly one place (no drift between copies).
 */
export const NOT_SET = "__unset__" as const;
