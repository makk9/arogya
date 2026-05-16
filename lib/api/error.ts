/**
 * Consistent API error responses per design.md 9.6:2780-2785.
 *
 * Shape: { error: { code, message, details? } } — nested under `error`.
 * The spec lists four codes; `invalid_state_transition` (409) is the
 * project-locked extension for domain state-machine violations
 * (already-discontinued med, already-resolved condition, etc.).
 */

export type ApiErrorCode =
  | "validation_failed"
  | "not_found"
  | "unauthorized"
  | "server_error"
  | "invalid_state_transition";

const DEFAULT_STATUS_FOR_CODE: Record<ApiErrorCode, number> = {
  validation_failed: 400,
  not_found: 404,
  unauthorized: 401,
  server_error: 500,
  invalid_state_transition: 409,
};

export function apiError(
  code: ApiErrorCode,
  message: string,
  details?: unknown,
  statusOverride?: number,
): Response {
  const errorBody: { code: ApiErrorCode; message: string; details?: unknown } = {
    code,
    message,
  };
  if (details !== undefined) errorBody.details = details;
  return Response.json(
    { error: errorBody },
    { status: statusOverride ?? DEFAULT_STATUS_FOR_CODE[code] },
  );
}
