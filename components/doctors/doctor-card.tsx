import Link from "next/link";

import type { Doctor } from "@/db/schema";
import { formatRelativeDate } from "@/lib/datetime";
import { displayDoctorName, doctorInitials } from "@/lib/doctor-display";

interface DoctorCardProps {
  patientId: string;
  doctor: Doctor;
  /** YYYY-MM-DD of the most recent linked visit; undefined when none. */
  lastVisit: string | undefined;
  medCount: number;
}

/*
 * Doctor list-card per design.md 6.4:1317:
 *   line 1: [avatar] [name]                    [specialty pill]
 *   line 2: [clinic] · last visit [relative]   [N meds prescribed]
 *
 * The specialty pill is mildly redundant with the section headers — accepted
 * trade-off for scannability per 6.4's deferred-polish note ("don't change").
 * Last visit is derived (Phase 4) and absent until the Visit vertical lands.
 * Pills are neutral semantic tokens; the brand accent stays out of list cards.
 */
export function DoctorCard({
  patientId,
  doctor,
  lastVisit,
  medCount,
}: DoctorCardProps) {
  const lineTwoParts: string[] = [];
  if (doctor.clinic) lineTwoParts.push(doctor.clinic);
  if (lastVisit) {
    lineTwoParts.push(`last visit ${formatRelativeDate(lastVisit)}`);
  }

  return (
    <Link
      href={`/patient/${patientId}/doctors/${doctor.id}`}
      className="block rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-foreground/30 hover:bg-muted/40"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[0.65rem] font-medium text-muted-foreground"
          >
            {doctorInitials(doctor.name)}
          </span>
          <span className="truncate text-sm font-medium">
            {displayDoctorName(doctor.name)}
          </span>
        </span>
        <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[0.7rem] text-muted-foreground">
          {doctor.specialty}
        </span>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3 pl-[2.375rem]">
        <span className="text-xs text-muted-foreground">
          {lineTwoParts.join(" · ")}
        </span>
        {medCount > 0 ? (
          <span className="shrink-0 text-xs text-muted-foreground">
            {medCount} {medCount === 1 ? "med" : "meds"} prescribed
          </span>
        ) : null}
      </div>
    </Link>
  );
}
