import Link from "next/link";

import {
  CATEGORY_OPTIONS,
  SEVERITY_OPTIONS,
  STATUS_OPTIONS,
} from "@/components/allergies/allergy-options";
import type { Allergy, Doctor } from "@/db/schema";
import { formatAbsoluteDate } from "@/lib/datetime";
import { displayDoctorName } from "@/lib/doctor-display";

interface AllergyCardProps {
  patientId: string;
  allergy: Allergy;
  /** The confirming doctor, when set and resolvable. */
  doctor: Doctor | undefined;
}

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
);
const SEVERITY_LABEL: Record<string, string> = Object.fromEntries(
  SEVERITY_OPTIONS.map((o) => [o.value, o.label]),
);
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
);

/*
 * Allergy list-card. §6.4 locks no Allergy card (the template powers four rail
 * items; Allergies is profile-reached per §6.10) — this layout is the Condition
 * card's three-line shape with allergy emphasis (see decisions.md 2026-06-10):
 *   line 1: [substance]                                  [category pill]
 *   line 2: [severity] · [reaction]                      [status pill]
 *   line 3: first noted [date] · confirmed by [Dr · specialty]
 *
 * Severity leads line 2 because it's the clinical headline (§6.5:1402 puts it
 * prominent on detail); "unknown" severity is skipped as noise (it's the
 * default-when-absent per §4:261). The confirming-doctor ref stays inert text —
 * cards are whole-card anchors (standing §6.4:1348 carryover).
 */
export function AllergyCard({ patientId, allergy, doctor }: AllergyCardProps) {
  const lineTwoParts: string[] = [];
  if (allergy.severity && allergy.severity !== "unknown") {
    lineTwoParts.push(SEVERITY_LABEL[allergy.severity] ?? allergy.severity);
  }
  if (allergy.reaction) {
    lineTwoParts.push(allergy.reaction);
  }

  const lineThreeParts: string[] = [];
  if (allergy.firstNoted) {
    lineThreeParts.push(`first noted ${formatAbsoluteDate(allergy.firstNoted)}`);
  }
  if (doctor) {
    lineThreeParts.push(
      `confirmed by ${displayDoctorName(doctor.name)} · ${doctor.specialty}`,
    );
  }

  return (
    <Link
      href={`/patient/${patientId}/allergies/${allergy.id}`}
      className="block rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-foreground/30 hover:bg-muted/40"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{allergy.substance}</span>
        <Pill>{CATEGORY_LABEL[allergy.category] ?? allergy.category}</Pill>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {lineTwoParts.join(" · ")}
        </span>
        <Pill>{STATUS_LABEL[allergy.status] ?? allergy.status}</Pill>
      </div>
      {lineThreeParts.length > 0 ? (
        <div className="mt-1 text-xs text-muted-foreground">
          {lineThreeParts.join(" · ")}
        </div>
      ) : null}
    </Link>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[0.7rem] text-muted-foreground">
      {children}
    </span>
  );
}
