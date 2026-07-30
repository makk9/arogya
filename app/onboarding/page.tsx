import { notFound } from "next/navigation";

import { OnboardingSurface } from "@/components/onboarding/onboarding-surface";
import { onboardingSessionQueries } from "@/db/queries";
import { getCurrentPatient } from "@/lib/auth";
import { loadOnboardingSnapshot } from "@/lib/onboarding/snapshot";

/*
 * Onboarding interview (design.md §5.8 / §6.3) — Phase E item E4. Lives
 * OUTSIDE the patient layout on purpose: the interview is a focused takeover
 * (chat left · live patient page right), not a wiki page — the rail returns
 * when the user lands on the dashboard. Patient identity is auth-derived; the
 * activation banner on the dashboard is the only launcher (§6.3:1249-1252).
 *
 * The session row is created lazily on the first turn (no orphan rows from
 * opening the page); a null session here just means a fresh interview.
 */

export const metadata = { title: "Getting set up · arogya" };

export default async function OnboardingPage() {
  const { patientId } = await getCurrentPatient();
  const [session, snapshot] = await Promise.all([
    onboardingSessionQueries.getForPatient(patientId),
    loadOnboardingSnapshot(patientId),
  ]);
  if (!snapshot) notFound();

  return (
    <main className="flex-1">
      <OnboardingSurface
        patientId={patientId}
        initialSnapshot={snapshot}
        initialMessages={session?.messages ?? []}
        initialPhase={session?.currentPhase ?? "patient"}
        completed={session?.status === "completed"}
      />
    </main>
  );
}
