import { redirect } from "next/navigation";

import { getCurrentPatient } from "@/lib/auth";

// The app's landing is the dashboard — §3's "wiki entry point." Stub-auth v1
// has exactly one patient, so the root resolves them and redirects; v1.5's
// real auth swaps inside getCurrentPatient(), not here (§9.6).
export default async function Home() {
  const patient = await getCurrentPatient();
  redirect(`/patient/${patient.patientId}/dashboard`);
}
