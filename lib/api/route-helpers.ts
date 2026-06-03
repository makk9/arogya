import { z } from "zod";

import { apiError } from "./error";

/**
 * Shared leaf helpers for app/api route handlers. Extracted once the Medication
 * and Condition verticals proved these identical across routes — Phase D
 * replicates them to ~11 entities, so they live here rather than being copied
 * per entity. Route *handlers* stay per-entity; only these utilities are shared.
 */

const uuidSchema = z.string().uuid();

/**
 * Coerce a date-only `YYYY-MM-DD` string to noon UTC. changedAt inputs are
 * date-only but the column is timestamptz; noon UTC is safe from day-boundary
 * flips in any patient timezone Pune-eastward and is clinically equivalent to
 * "logged on this day" for backdated entries. A tz-aware refinement is queued
 * for when lib/datetime.ts gains date-fns / DST arithmetic.
 */
export function coerceChangedAt(dateStr: string | undefined): Date | undefined {
  if (!dateStr) return undefined;
  return new Date(`${dateStr}T12:00:00Z`);
}

/**
 * Parse a request's JSON body, returning a discriminated result so handlers can
 * `if (!parsed.ok) return parsed.response;` instead of repeating the try/catch.
 */
export async function parseJsonBody(
  req: Request,
): Promise<{ ok: true; data: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, data: await req.json() };
  } catch {
    return {
      ok: false,
      response: apiError("validation_failed", "Request body is not valid JSON"),
    };
  }
}

/**
 * Validate a single dynamic path param as a uuid. `label` shapes the error
 * message ("Invalid condition id"). Pass `ctx.params` and the key to read.
 */
export async function validateUuidParam<K extends string>(
  params: Promise<Record<K, string>>,
  key: K,
  label: string,
): Promise<{ ok: true; id: string } | { ok: false; response: Response }> {
  const resolved = await params;
  const parsed = uuidSchema.safeParse(resolved[key]);
  if (!parsed.success) {
    return { ok: false, response: apiError("validation_failed", `Invalid ${label}`) };
  }
  return { ok: true, id: parsed.data };
}

/**
 * Build a per-field RHF-routable error payload from a domain error's
 * `{ field?, reason? }` meta. `reason` is a stable CODE (e.g. "doctor_not_found",
 * "no_op", "condition_not_found"); each route supplies its own code→message map
 * because the copy is entity-specific ("managing" vs "prescribing" doctor) while
 * the mechanism is shared.
 */
export function fieldErrorsFromReason(
  meta: { field?: string; reason?: string },
  messages: Record<string, string>,
  fallback = "Couldn't use that value.",
): { fieldErrors: Record<string, string[]> } {
  const field = meta.field ?? "newValue";
  const message = (meta.reason && messages[meta.reason]) ?? fallback;
  return { fieldErrors: { [field]: [message] } };
}
