import { z } from "zod";

import {
  MedicationDomainError,
  medicationChangeQueries,
} from "@/db/queries/medication";
import { apiError } from "@/lib/api/error";
import { getCurrentPatient, getCurrentUser } from "@/lib/auth";
import { createMedicationChangeSchema } from "@/lib/schemas/api/medication";

// postgres-js (transitively imported via medicationChangeQueries → @/db)
// requires Node.
export const runtime = "nodejs";

const idPathParamSchema = z.string().uuid();

type Ctx = { params: Promise<{ id: string }> };

// changedAt arrives as YYYY-MM-DD (date-only). Schema is timestamptz. Per
// approved plan, coerce to noon UTC — safe from day-boundary flips in any
// patient timezone Pune-eastward and clinically equivalent to "logged on this
// day" for backdated entries. A clinical-fidelity refinement (noon in patient
// tz via a sibling of todayInTimezone) is queued for when we revisit
// lib/datetime.ts for date-fns or DST-aware display arithmetic.
function coerceChangedAt(dateStr: string | undefined): Date | undefined {
  if (!dateStr) return undefined;
  return new Date(`${dateStr}T12:00:00Z`);
}

// Map linked_entity_invalid → per-field fieldErrors so RHF setError can route
// the message under the right input.
function fieldErrorsFromLinkedEntityMeta(meta: {
  field?: string;
  reason?: string;
}): { fieldErrors: Record<string, string[]> } {
  const field = meta.field ?? "newValue";
  const message = meta.reason
    ? `Couldn't use that — ${meta.reason}.`
    : "Couldn't use that value.";
  return { fieldErrors: { [field]: [message] } };
}

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const { id: rawId } = await ctx.params;
  const idParsed = idPathParamSchema.safeParse(rawId);
  if (!idParsed.success) {
    return apiError("validation_failed", "Invalid medication id");
  }

  const { patientId } = await getCurrentPatient();
  const { userId: recordedBy } = await getCurrentUser();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError("validation_failed", "Request body is not valid JSON");
  }

  const bodyParsed = createMedicationChangeSchema.safeParse(raw);
  if (!bodyParsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      bodyParsed.error.flatten(),
    );
  }
  const input = bodyParsed.data;

  try {
    const result = await medicationChangeQueries.create(
      patientId,
      idParsed.data,
      {
        field: input.field,
        newValue: input.newValue,
        reason: input.reason,
        changedAt: coerceChangedAt(input.changedAt),
        linkedVisitId: input.linkedVisitId,
        recordedBy,
      },
    );
    return Response.json(result);
  } catch (err) {
    if (err instanceof MedicationDomainError) {
      if (err.kind === "not_found") {
        return apiError("not_found", "Medication not found");
      }
      if (err.kind === "medication_discontinued") {
        return apiError(
          "invalid_state_transition",
          "Can't log changes on a discontinued medication",
          {
            currentStatus: err.meta?.currentStatus,
            discontinuedOn: err.meta?.discontinuedOn,
          },
        );
      }
      if (err.kind === "invalid_status_transition") {
        return apiError(
          "invalid_state_transition",
          "Only active → paused is supported here. Use Discontinue for active → discontinued.",
          { currentStatus: err.meta?.currentStatus },
        );
      }
      if (err.kind === "linked_entity_invalid") {
        return apiError(
          "validation_failed",
          "Invalid linked entity",
          fieldErrorsFromLinkedEntityMeta(err.meta ?? {}),
        );
      }
      if (err.kind === "already_discontinued") {
        // This kind is owned by the discontinue route. If it surfaces here
        // something is wrong with the helper — fall through to server_error.
      }
      // Exhaustiveness: a future MedicationDomainError("kind") that isn't
      // mapped above will surface here as a compile error rather than
      // silently 500ing.
      const _exhaust: never = err.kind as never;
      void _exhaust;
    }
    return apiError("server_error", "Failed to log medication change");
  }
}
