import "server-only";

/**
 * PHI-aware logger per design.md 9.6:2845 + CLAUDE.md ("refuses entity content,
 * prompt content, AI output content, names, DOBs, addresses, phone numbers; log
 * error codes and metadata only").
 *
 * The guard rail is the type signature, not runtime scrubbing: the API only
 * accepts structured, non-PHI metadata — an operation name, a stable error
 * code, and opaque identifiers (uuids are not PHI). There is deliberately NO
 * free-form `message` parameter and no way to pass an entity, so a caller
 * cannot leak `notes`, a patient name, or an AI completion through it.
 *
 * Wraps console (the one sanctioned place; `no-console` is not enforced and
 * lib/env.ts already logs this way). server-only so it can never run client-side.
 */

type LogMeta = {
  // Static operation label, e.g. "conditions.create". Never interpolate PHI.
  op: string;
  // Stable, non-PHI code: an Error name, a domain-error kind, or a pg SQLSTATE.
  code?: string;
  // Opaque identifiers only (entity uuids, patientId). uuids are not PHI.
  ids?: Record<string, string | undefined>;
};

function emit(level: "error" | "warn" | "info", meta: LogMeta): void {
  const line: Record<string, unknown> = {
    level,
    op: meta.op,
    at: new Date().toISOString(),
  };
  if (meta.code) line.code = meta.code;
  if (meta.ids) line.ids = meta.ids;
  console[level](JSON.stringify(line));
}

export const logger = {
  error: (meta: LogMeta) => emit("error", meta),
  warn: (meta: LogMeta) => emit("warn", meta),
  info: (meta: LogMeta) => emit("info", meta),
};

/**
 * Extracts a safe code from an unknown thrown value — its constructor name plus
 * any string `.code` property (Error.name, a domain-error kind, a pg SQLSTATE).
 * Never reads `.message`, which can embed PHI.
 */
export function errorCode(err: unknown): string {
  if (err && typeof err === "object") {
    const name = err.constructor?.name ?? "Error";
    const raw = (err as { code?: unknown }).code;
    const code = typeof raw === "string" ? raw : undefined;
    return code ? `${name}:${code}` : name;
  }
  return "UnknownError";
}
