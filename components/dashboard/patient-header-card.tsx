import Link from "next/link";

import { previewContext } from "@/components/patient/patient-at-a-glance-section";
import { PatientAvatar } from "@/components/patient/patient-avatar";
import type { GlancePreview } from "@/db/queries/patient";
import { formatRelativeDate } from "@/lib/datetime";

/*
 * §6.1:1153 patient header card — name / age / active conditions / doctors /
 * last activity. The orientation strip at the top of the dashboard; each
 * column links to its fuller surface (profile, conditions, doctors). "Last
 * activity" is the newest event in the recent-timeline merge, so the two
 * cards can never disagree about what happened most recently.
 */

const COL_LABEL =
  "font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground";

export function PatientHeaderCard({
  patientId,
  name,
  photoUrl,
  age,
  conditions,
  doctors,
  lastActivity,
}: {
  patientId: string;
  name: string;
  photoUrl: string | null;
  age: number | null;
  conditions: GlancePreview;
  doctors: GlancePreview;
  lastActivity: Date | null;
}) {
  const base = `/patient/${patientId}`;

  return (
    <section className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-lg border border-border bg-card px-5 py-4">
      <Link href={base} className="flex min-w-0 items-center gap-3 hover:opacity-90">
        <PatientAvatar name={name} photoUrl={photoUrl} editing={false} />
        <span className="min-w-0">
          <span className="block truncate text-base font-medium text-foreground">
            {name}
          </span>
          <span className="block text-sm text-muted-foreground">
            {age !== null ? `${age} years` : "Age not set"}
          </span>
        </span>
      </Link>

      <Link href={`${base}/conditions`} className="group min-w-0">
        <span className={COL_LABEL}>Conditions</span>
        <span className="block truncate text-sm text-foreground group-hover:underline group-hover:underline-offset-4">
          {previewContext(conditions, "None recorded")}
        </span>
      </Link>

      <Link href={`${base}/doctors`} className="group min-w-0">
        <span className={COL_LABEL}>Doctors</span>
        <span className="block truncate text-sm text-foreground group-hover:underline group-hover:underline-offset-4">
          {previewContext(doctors, "None recorded")}
        </span>
      </Link>

      <span className="ml-auto min-w-0 text-right">
        <span className={COL_LABEL}>Last activity</span>
        <span className="block text-sm text-muted-foreground">
          {lastActivity ? formatRelativeDate(lastActivity) : "—"}
        </span>
      </span>
    </section>
  );
}
