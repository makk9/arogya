import Link from "next/link";

import { DashboardCard, DashboardCardEmpty } from "@/components/dashboard/dashboard-card";
import type { Doctor, Medication } from "@/db/schema";
import { displayDoctorName } from "@/lib/doctor-display";

/*
 * §6.1:1153 CURRENT MEDS card — active medications with the prescribing-doctor
 * pill inline (§6.1:1158: the pill "reinforces cross-specialist synthesis").
 * Doctor pills carry the accent tint per the vault-pill convention; the row
 * links to the medication detail, the pill to the doctor.
 */

const SHOWN = 5;

export function CurrentMedsCard({
  patientId,
  medications,
  doctorsById,
}: {
  patientId: string;
  medications: Medication[];
  doctorsById: Map<string, Doctor>;
}) {
  const base = `/patient/${patientId}`;
  const shown = medications.slice(0, SHOWN);
  const overflow = medications.length - shown.length;

  return (
    <DashboardCard
      title="Current meds"
      action={
        medications.length > 0
          ? { label: "all medications →", href: `${base}/medications` }
          : undefined
      }
    >
      {medications.length === 0 ? (
        <DashboardCardEmpty
          headline="No active medications"
          explanation="Add what's currently prescribed — doses, frequency, and who prescribed it."
          cta={{ label: "Add a medication", href: `${base}/medications/new` }}
        />
      ) : (
        <ul>
          {shown.map((med) => {
            const doctor = med.prescribingDoctor
              ? doctorsById.get(med.prescribingDoctor)
              : undefined;
            return (
              <li
                key={med.id}
                className="flex items-baseline justify-between gap-3 border-b border-border/60 px-4 py-2.5 last:border-b-0"
              >
                <Link
                  href={`${base}/medications/${med.id}`}
                  className="min-w-0 text-sm underline-offset-4 hover:underline"
                >
                  <span className="font-medium text-foreground">{med.name}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {med.currentDose} · {med.currentFrequency}
                  </span>
                </Link>
                {doctor ? (
                  <Link
                    href={`${base}/doctors/${doctor.id}`}
                    className="shrink-0 rounded-full bg-accent px-2 py-0.5 font-mono text-[0.7rem] leading-relaxed text-accent-foreground ring-1 ring-accent-foreground/15 hover:ring-accent-foreground/40"
                  >
                    {displayDoctorName(doctor.name)}
                  </Link>
                ) : null}
              </li>
            );
          })}
          {overflow > 0 ? (
            <li className="px-4 py-2.5">
              <Link
                href={`${base}/medications`}
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                + {overflow} more →
              </Link>
            </li>
          ) : null}
        </ul>
      )}
    </DashboardCard>
  );
}
