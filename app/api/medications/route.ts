import { medicationQueries } from "@/db/queries/medication";
import { apiError } from "@/lib/api/error";
import { getCurrentPatient } from "@/lib/auth";
import {
  createMedicationSchema,
  listMedicationsQuerySchema,
} from "@/lib/schemas/api/medication";

// postgres-js (transitively imported via medicationQueries → @/db) requires Node.
export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const queryParsed = listMedicationsQuerySchema.safeParse(
    statusParam !== null ? { status: statusParam } : {},
  );
  if (!queryParsed.success) {
    return apiError(
      "validation_failed",
      "Invalid query parameters",
      queryParsed.error.flatten(),
    );
  }

  try {
    const medications = queryParsed.data.status
      ? await medicationQueries.byStatus(patientId, queryParsed.data.status)
      : await medicationQueries.forPatient(patientId);
    return Response.json({ medications });
  } catch {
    return apiError("server_error", "Failed to list medications");
  }
}

export async function POST(req: Request): Promise<Response> {
  const { patientId } = await getCurrentPatient();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError("validation_failed", "Request body is not valid JSON");
  }

  const parsed = createMedicationSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError(
      "validation_failed",
      "Invalid request body",
      parsed.error.flatten(),
    );
  }

  try {
    const medication = await medicationQueries.create({
      ...parsed.data,
      patientId,
    });
    return Response.json({ medication }, { status: 201 });
  } catch {
    return apiError("server_error", "Failed to create medication");
  }
}
