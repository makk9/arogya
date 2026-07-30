import { notFound } from "next/navigation";
import { after } from "next/server";

import { ActivationBanner } from "@/components/dashboard/activation-banner";
import { Breadcrumb } from "@/components/breadcrumb";
import { CurrentMedsCard } from "@/components/dashboard/current-meds-card";
import { DashboardChatBar } from "@/components/dashboard/dashboard-chat-bar";
import { KeyMarkersCard } from "@/components/dashboard/key-markers-card";
import { PatientHeaderCard } from "@/components/dashboard/patient-header-card";
import { RecentTimelineCard } from "@/components/dashboard/recent-timeline-card";
import { TopInsightCard } from "@/components/dashboard/top-insight-card";
import { recentActivity } from "@/db/queries/dashboard";
import { doctorQueries } from "@/db/queries/doctor";
import { insightQueries } from "@/db/queries/insight";
import { medicationQueries } from "@/db/queries/medication";
import { onboardingSessionQueries } from "@/db/queries/onboarding-session";
import { patientQueries } from "@/db/queries/patient";
import { vitalQueries } from "@/db/queries/vital";
import { getCurrentPatient } from "@/lib/auth";
import { ageInYears, todayInTimezone } from "@/lib/datetime";

/*
 * Dashboard per design.md §6.1 — the orientation surface and wiki entry
 * point. Locked layout (§6.1:1147-1153): the user scans status top-to-bottom
 * — header card · key markers · current meds · top insight · recent timeline
 * — and the chat surface sits at the BOTTOM as the natural next action (the
 * centerpiece framing was explicitly reversed). Fixed layout in v1.
 *
 * Phase E ships the shell only: the activation banner + `setup · N of 4`
 * counter are Phase F (incomplete-onboarding logic); per-card dashed empty
 * states are the §6.1 pattern and ship here.
 *
 * §4:583's "new → seen on dashboard load" lands at its intended home: the
 * top insight (the only insight this surface displays) flips via after(),
 * mirroring the feed's displayed-only posture.
 */

// Insight statuses the top-insight slot considers "open" — dismissed and
// resolved insights are settled and shouldn't re-headline the dashboard.
const OPEN_INSIGHT_STATUS = new Set(["new", "seen", "saved"]);

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const current = await getCurrentPatient();
  if (id !== current.patientId) notFound();

  const today = todayInTimezone(current.timezone);
  const [ty, tm, td] = today.split("-").map(Number);
  const visitsSince = new Date(Date.UTC(ty, tm - 1, td - 30))
    .toISOString()
    .slice(0, 10);

  const [
    patient,
    glance,
    activeMeds,
    doctors,
    vitals,
    insights,
    activity,
    onboarding,
  ] = await Promise.all([
    patientQueries.getById(current.patientId),
    patientQueries.atAGlance(current.patientId, visitsSince, today),
    medicationQueries.active(current.patientId),
    doctorQueries.forPatient(current.patientId),
    vitalQueries.forPatient(current.patientId),
    insightQueries.forPatient(current.patientId),
    recentActivity(current.patientId, today, 8),
    onboardingSessionQueries.getForPatient(current.patientId),
  ]);
  if (!patient) notFound();

  const doctorsById = new Map(doctors.map((d) => [d.id, d]));
  const topInsight =
    insights.find((i) => OPEN_INSIGHT_STATUS.has(i.status)) ?? null;
  const firstName = current.name.trim().split(/\s+/)[0] || "your family member";

  // §4:583 new→seen for the insight this surface displays. Post-response so
  // this render still shows the unread rail badge; it clears on the next
  // navigation (standard unread semantics). Silent failure retries next load.
  if (topInsight && topInsight.status === "new") {
    const seenId = topInsight.id;
    after(async () => {
      try {
        await insightQueries.markSeen(current.patientId, [seenId]);
      } catch {
        // Non-fatal — the transition re-runs on the next dashboard load.
      }
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-8 py-8">
      <Breadcrumb patientId={current.patientId} trail={[{ label: "dashboard" }]} />
      <h1 className="mb-6 font-heading text-2xl font-semibold text-foreground">
        Dashboard
      </h1>

      <div className="flex flex-col gap-4">
        {/* §6.3:1249 — the interview's only launcher. Shown until the interview
            completes; the N-of-4 counter + adaptive logic are Phase F. */}
        {onboarding?.status !== "completed" ? <ActivationBanner /> : null}

        <PatientHeaderCard
          patientId={current.patientId}
          name={patient.name}
          photoUrl={patient.photoUrl}
          age={patient.dateOfBirth ? ageInYears(patient.dateOfBirth, today) : null}
          conditions={glance.conditions}
          doctors={glance.doctors}
          lastActivity={activity[0]?.date ?? null}
        />

        <KeyMarkersCard patientId={current.patientId} readings={vitals} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CurrentMedsCard
            patientId={current.patientId}
            medications={activeMeds}
            doctorsById={doctorsById}
          />
          <TopInsightCard
            patientId={current.patientId}
            insight={topInsight}
            totalCount={insights.length}
          />
        </div>

        <RecentTimelineCard patientId={current.patientId} items={activity} />
      </div>

      <div className="mt-8 border-t border-border pt-6">
        <DashboardChatBar
          patientId={current.patientId}
          patientFirstName={firstName}
        />
      </div>
    </main>
  );
}
