/*
 * Lab marker flag helpers.
 *
 * A lab result stores its `flag` (normal/low/high/critical) independently of the
 * measured value and reference range — the three are entered (or, in Phase E,
 * extracted) but never reconciled, so nothing stops a value that sits inside its
 * range from being flagged "high" (garbage-in). `deriveFlag` computes the flag
 * implied by the value vs the reference interval (the clinical H/L rule), and
 * `flagContradictsRange` reports a clear contradiction so manual entry and the
 * Phase-E extraction-confirmation screen can WARN — never block: labs
 * legitimately override, and `critical` is a panic-threshold tier the stored
 * range can't determine.
 */

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * The flag implied by the value vs its reference interval — "low" / "high" /
 * "normal". Returns null when it can't be determined (no numeric value, or no
 * reference bound to compare against). Never returns "critical": that's a
 * separate panic threshold not encoded in the reference range.
 */
export function deriveFlag(
  value: string | number | null | undefined,
  referenceLow: string | number | null | undefined,
  referenceHigh: string | number | null | undefined,
): "normal" | "low" | "high" | null {
  const v = num(value);
  const lo = num(referenceLow);
  const hi = num(referenceHigh);
  if (v === null || (lo === null && hi === null)) return null;
  if (lo !== null && v < lo) return "low";
  if (hi !== null && v > hi) return "high";
  return "normal";
}

/**
 * True when the stored `flag` clearly contradicts what the value vs range
 * implies — a sanity check for manual entry / extraction review. Returns false
 * (no opinion) when the flag is unset, when it's `critical` (the range can't
 * judge the panic tier), or when value/range can't derive an expected flag.
 */
export function flagContradictsRange(
  flag: string | null | undefined,
  value: string | number | null | undefined,
  referenceLow: string | number | null | undefined,
  referenceHigh: string | number | null | undefined,
): boolean {
  if (!flag || flag === "critical") return false;
  const derived = deriveFlag(value, referenceLow, referenceHigh);
  if (derived === null) return false;
  return derived !== flag;
}
