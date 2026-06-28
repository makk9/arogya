import Link from "next/link";

import { MarkerFlagPill } from "@/components/labs/marker-display";
import type { LabResult, Medication } from "@/db/schema";
import { formatAbsoluteDate } from "@/lib/datetime";

export interface LinkedMedRef {
  id: string;
  name: string;
  currentDose: string;
  status: Medication["status"];
}

export interface LinkedLabRef {
  id: string;
  labReportId: string;
  marker: string;
  resultDate: string;
  flag: LabResult["flag"];
}

interface Props {
  patientId: string;
  linkedMeds: LinkedMedRef[];
  linkedLabs: LinkedLabRef[];
}

/*
 * Linked context per design.md 6.5:1382 + Condition emphasis (6.5:1400):
 * "medications treating, labs monitoring." Plain link list with light context
 * (not preview cards) plus a status pill on the right where applicable.
 *
 * Medications link to their existing detail pages (`§ name · dose`) with their
 * status pill on the right. Lab markers link to their parent lab report's detail
 * page (`marker · date`) — there is no per-marker page, so the report is the
 * target. A flagged marker carries the shared `MarkerFlagPill` (the colored
 * △ + SLIGHTLY HIGH / LOW / CRITICAL pill used in the §6.7 markers table); an
 * unflagged marker shows nothing. Symptoms + visits deferred. The page omits
 * this whole section when both lists are empty (§6.5 LifestyleProfile precedent).
 *
 * The med status pill is a neutral semantic token; flag severity is the one
 * place color is intentional (warning/destructive), matching the markers table.
 */

const MED_STATUS_LABEL: Record<Medication["status"], string> = {
  active: "Active",
  paused: "Paused",
  discontinued: "Discontinued",
};

export function ConditionLinkedContext({
  patientId,
  linkedMeds,
  linkedLabs,
}: Props) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Linked context
      </h2>
      <ul className="space-y-2">
        {linkedMeds.map((m) => (
          <li
            key={m.id}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <Link
              href={`/patient/${patientId}/medications/${m.id}`}
              className="min-w-0 underline-offset-4 hover:underline"
            >
              <span className="text-muted-foreground">§</span> {m.name} ·{" "}
              {m.currentDose}
            </Link>
            <Pill>{MED_STATUS_LABEL[m.status]}</Pill>
          </li>
        ))}
        {linkedLabs.map((l) => (
          <li
            key={l.id}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <Link
              href={`/patient/${patientId}/labs/${l.labReportId}`}
              className="min-w-0 underline-offset-4 hover:underline"
            >
              {l.marker} · {formatAbsoluteDate(l.resultDate)}
              <span className="ml-2 text-muted-foreground">monitoring</span>
            </Link>
            <MarkerFlagPill flag={l.flag} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[0.7rem] text-muted-foreground">
      {children}
    </span>
  );
}
