import Link from "next/link";

import type { Condition, Doctor, Medication } from "@/db/schema";

interface MedicationCardProps {
  patientId: string;
  medication: Medication;
  doctor: Doctor | undefined;
  condition: Condition | undefined;
}

/*
 * Medication list-card per design.md 6.4. Two lines:
 *   line 1: [Name] [brandName?] [dose]                    [↑ recent change]
 *   line 2: [frequency] · [condition] · [D doctor · specialty]
 *
 * Doctor and condition references render as inert plain text this round
 * (no Link). Their detail pages land in Phase D; until then the wiring stays
 * on the parent medication card (Phase C plan D2). The recent-change
 * indicator is deferred until we know what "recent" should mean in practice
 * (plan D5) — TODO below.
 */
export function MedicationCard({
  patientId,
  medication,
  doctor,
  condition,
}: MedicationCardProps) {
  const lineTwoParts: string[] = [medication.currentFrequency];
  if (condition?.name) lineTwoParts.push(condition.name);
  if (doctor) lineTwoParts.push(`Dr ${doctor.name} · ${doctor.specialty}`);

  return (
    <Link
      href={`/patient/${patientId}/medications/${medication.id}`}
      className="block rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-foreground/30 hover:bg-muted/40"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium">{medication.name}</span>
        {medication.brandName ? (
          <span className="text-xs text-muted-foreground">
            ({medication.brandName})
          </span>
        ) : null}
        <span className="text-sm text-muted-foreground">
          {medication.currentDose}
        </span>
        {/* TODO Phase C item 5+: render [↑ recent change] indicator on the
            right when a medication_changes row exists within the (TBD) recent
            window. Deferred until we have usage data. */}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {lineTwoParts.join(" · ")}
      </div>
    </Link>
  );
}
