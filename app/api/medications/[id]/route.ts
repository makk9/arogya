import { z } from "zod";

import { medicationQueries } from "@/db/queries/medication";
import { apiError } from "@/lib/api/error";
import { getCurrentPatient } from "@/lib/auth";
import { updateMedicationSchema } from "@/lib/schemas/api/medication";

// postgres-js (transitively imported via medicationQueries → @/db) requires Node.
export const runtime = "nodejs";

const idPathParamSchema = z.string().uuid();

// PATCH refuses the four medicationChangeField enum fields. Per-field guidance
// lives here (not in the Zod schema) so the rejection response can carry a
// structured `details` object keyed by field name — error responses as a
// teaching surface (see memory: error-response-teaching-surface).
//
// `/resume` is referenced but unimplemented in v1; pause→active transition
// ships in v1.5 alongside the broader status state-machine.
const CLINICAL_FIELD_GUIDANCE: Record<string, string> = {
  currentDose: "Use POST /api/medications/[id]/changes",
  currentFrequency: "Use POST /api/medications/[id]/changes",
  prescribingDoctor: "Use POST /api/medications/[id]/changes",
  status:
    "Use POST /api/medications/[id]/discontinue. (Resume from paused → active is v1.5.)",
};

type Ctx = { params: Promise<{ id: string }> };

async function validateIdParam(ctx: Ctx): Promise<
  | { ok: true; id: string }
  | { ok: false; response: Response }
> {
  const { id } = await ctx.params;
  const parsed = idPathParamSchema.safeParse(id);
  if (!parsed.success) {
    return {
      ok: false,
      response: apiError("validation_failed", "Invalid medication id"),
    };
  }
  return { ok: true, id: parsed.data };
}

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateIdParam(ctx);
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    const medication = await medicationQueries.getById(patientId, idCheck.id);
    if (!medication) {
      return apiError("not_found", "Medication not found");
    }
    return Response.json({ medication });
  } catch {
    return apiError("server_error", "Failed to read medication");
  }
}

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateIdParam(ctx);
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError("validation_failed", "Request body is not valid JSON");
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return apiError("validation_failed", "Request body must be a JSON object");
  }

  const rejectedFields: Record<string, string> = {};
  for (const key of Object.keys(raw)) {
    if (key in CLINICAL_FIELD_GUIDANCE) {
      rejectedFields[key] = CLINICAL_FIELD_GUIDANCE[key];
    }
  }
  if (Object.keys(rejectedFields).length > 0) {
    return apiError(
      "validation_failed",
      "Clinical-event fields must be updated via dedicated endpoints",
      { rejectedFields },
    );
  }

  const parsed = updateMedicationSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const medication = await medicationQueries.update(
      patientId,
      idCheck.id,
      parsed.data,
    );
    if (!medication) {
      return apiError("not_found", "Medication not found");
    }
    return Response.json({ medication });
  } catch {
    return apiError("server_error", "Failed to update medication");
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateIdParam(ctx);
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    const deleted = await medicationQueries.delete(patientId, idCheck.id);
    if (!deleted) {
      return apiError("not_found", "Medication not found");
    }
    return new Response(null, { status: 204 });
  } catch {
    return apiError("server_error", "Failed to delete medication");
  }
}
