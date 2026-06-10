import { DoctorDomainError, doctorQueries } from "@/db/queries/doctor";
import { apiError } from "@/lib/api/error";
import { parseJsonBody, validateUuidParam } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { updateDoctorSchema } from "@/lib/schemas/api/doctor";

// postgres-js (transitively imported via doctorQueries → @/db) requires Node.
export const runtime = "nodejs";

// PATCH refuses the two change-logged fields (decisions.md 2026-06-09:
// specialty + clinic are clinical-history events — a clinic move matters to
// synthesis). Per-field guidance lives here so the rejection response carries a
// structured `details` object keyed by field name.
const LOGGED_FIELD_GUIDANCE: Record<string, string> = {
  specialty: "Use POST /api/doctors/[id]/changes",
  clinic: "Use POST /api/doctors/[id]/changes",
};

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "doctor id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    const doctor = await doctorQueries.getById(patientId, idCheck.id);
    if (!doctor) {
      return apiError("not_found", "Doctor not found");
    }
    return Response.json({ doctor });
  } catch (err) {
    logger.error({
      op: "doctors.get",
      code: errorCode(err),
      ids: { patientId, doctorId: idCheck.id },
    });
    return apiError("server_error", "Failed to read doctor");
  }
}

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "doctor id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;
  const raw = body.data;

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return apiError("validation_failed", "Request body must be a JSON object");
  }

  const rejectedFields: Record<string, string> = {};
  for (const key of Object.keys(raw)) {
    if (Object.hasOwn(LOGGED_FIELD_GUIDANCE, key)) {
      rejectedFields[key] = LOGGED_FIELD_GUIDANCE[key];
    }
  }
  if (Object.keys(rejectedFields).length > 0) {
    return apiError(
      "validation_failed",
      "Change-logged fields must be updated via dedicated endpoints",
      { rejectedFields },
    );
  }

  const parsed = updateDoctorSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const doctor = await doctorQueries.update(patientId, idCheck.id, parsed.data);
    if (!doctor) {
      return apiError("not_found", "Doctor not found");
    }
    return Response.json({ doctor });
  } catch (err) {
    logger.error({
      op: "doctors.update",
      code: errorCode(err),
      ids: { patientId, doctorId: idCheck.id },
    });
    return apiError("server_error", "Failed to update doctor");
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const idCheck = await validateUuidParam(ctx.params, "id", "doctor id");
  if (!idCheck.ok) return idCheck.response;

  const { patientId } = await getCurrentPatient();

  try {
    const deleted = await doctorQueries.delete(patientId, idCheck.id);
    if (!deleted) {
      return apiError("not_found", "Doctor not found");
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof DoctorDomainError && err.kind === "delete_blocked") {
      const count = err.meta?.visitCount ?? 0;
      return apiError(
        "delete_blocked",
        `This doctor has ${count} ${count === 1 ? "visit" : "visits"} on file. Visits keep their doctor — reassign or remove them first.`,
        { visitCount: count },
      );
    }
    logger.error({
      op: "doctors.delete",
      code: errorCode(err),
      ids: { patientId, doctorId: idCheck.id },
    });
    return apiError("server_error", "Failed to delete doctor");
  }
}
