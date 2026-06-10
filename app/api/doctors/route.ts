import { doctorQueries } from "@/db/queries/doctor";
import { apiError } from "@/lib/api/error";
import { parseJsonBody } from "@/lib/api/route-helpers";
import { getCurrentPatient } from "@/lib/auth";
import { errorCode, logger } from "@/lib/logger";
import { createDoctorSchema } from "@/lib/schemas/api/doctor";

// postgres-js (transitively imported via doctorQueries → @/db) requires Node.
export const runtime = "nodejs";

// No query-param filter (unlike /api/conditions?status=): specialty is free
// text in v1, so there's no enum to validate against, and the list page filters
// server-side in the page component.
export async function GET(): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  try {
    const doctors = await doctorQueries.forPatient(patientId);
    return Response.json({ doctors });
  } catch (err) {
    logger.error({ op: "doctors.list", code: errorCode(err), ids: { patientId } });
    return apiError("server_error", "Failed to list doctors");
  }
}

export async function POST(req: Request): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = createDoctorSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const doctor = await doctorQueries.create({ ...parsed.data, patientId });
    return Response.json({ doctor }, { status: 201 });
  } catch (err) {
    logger.error({ op: "doctors.create", code: errorCode(err), ids: { patientId } });
    return apiError("server_error", "Failed to create doctor");
  }
}
