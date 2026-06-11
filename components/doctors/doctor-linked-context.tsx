import Link from "next/link";

import { STATUS_OPTIONS } from "@/components/conditions/condition-options";
import type { Condition, Medication } from "@/db/schema";
import { formatAbsoluteDate } from "@/lib/datetime";
import { EntityTypeGlyph } from "@/components/entity-type-glyph";

export interface LinkedMedRef {
  id: string;
  name: string;
  currentDose: string;
  status: Medication["status"];
}

export interface LinkedConditionRef {
  id: string;
  name: string;
  status: Condition["status"];
}

export interface LinkedLabOrderRef {
  id: string;
  reportDate: string;
  labName: string | null;
  reportType: string | null;
}

export interface LinkedVisitRef {
  id: string;
  visitDate: string;
  visitType: string | null;
}

interface Props {
  patientId: string;
  linkedMeds: LinkedMedRef[];
  linkedConditions: LinkedConditionRef[];
  linkedLabOrders: LinkedLabOrderRef[];
  linkedVisits: LinkedVisitRef[];
}

/*
 * Linked context per design.md 6.5:1401 (Doctor emphasis): "medications
 * prescribed, conditions managed, lab orders, visits." These are the wiki
 * backlinks — derived at render time from FKs pointing AT this doctor, never
 * stored (Phase 3 tripwire). Plain link list with light context per 6.5:1382.
 *
 * Medications and conditions link to their detail pages with a status pill on
 * the right. Lab orders and visits render as inert rows — their detail pages
 * land later in Phase D (the `Link` wrapper joins then), and both lists stay
 * empty until those verticals ship a create path. The page omits this whole
 * section when all four lists are empty.
 */

const MED_STATUS_LABEL: Record<Medication["status"], string> = {
  active: "Active",
  paused: "Paused",
  discontinued: "Discontinued",
};

const CONDITION_STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
);

export function DoctorLinkedContext({
  patientId,
  linkedMeds,
  linkedConditions,
  linkedLabOrders,
  linkedVisits,
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
              <span className="ml-2 text-muted-foreground">prescribed</span>
            </Link>
            <Pill>{MED_STATUS_LABEL[m.status]}</Pill>
          </li>
        ))}
        {linkedConditions.map((c) => (
          <li
            key={c.id}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <Link
              href={`/patient/${patientId}/conditions/${c.id}`}
              className="min-w-0 underline-offset-4 hover:underline"
            >
              <span className="text-muted-foreground">§</span> {c.name}
              <span className="ml-2 text-muted-foreground">manages</span>
            </Link>
            <Pill>{CONDITION_STATUS_LABEL[c.status] ?? c.status}</Pill>
          </li>
        ))}
        {linkedLabOrders.map((l) => (
          <li key={l.id} className="text-sm">
            <span className="text-muted-foreground">§</span>{" "}
            {l.reportType ?? "Lab report"} ·{" "}
            {formatAbsoluteDate(l.reportDate)}
            {l.labName ? (
              <span className="ml-2 text-muted-foreground">{l.labName}</span>
            ) : null}
            <span className="ml-2 text-muted-foreground">ordered</span>
          </li>
        ))}
        {linkedVisits.map((v) => (
          <li key={v.id} className="text-sm">
            <EntityTypeGlyph letter="V" />
            Visit ·{" "}
            {formatAbsoluteDate(v.visitDate)}
            {v.visitType ? (
              <span className="ml-2 text-muted-foreground">{v.visitType}</span>
            ) : null}
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
