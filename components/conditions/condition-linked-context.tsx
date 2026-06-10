import Link from "next/link";

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
 * status pill on the right. Lab markers render as inert text (`marker · date`)
 * — lab detail pages land later in Phase D; the `Link` wrapper joins then.
 * Per §6.7, the `△` glyph + a flag pill are reserved for genuinely flagged
 * markers (low / high / critical); a normal/unflagged marker shows neither.
 * Symptoms + visits deferred. The page omits this whole section when both lists
 * are empty (§6.5 LifestyleProfile precedent).
 *
 * Pills are neutral semantic tokens (no color register) — the brand accent is
 * still stone-only/deferred (7.2 anti-pattern).
 */

const MED_STATUS_LABEL: Record<Medication["status"], string> = {
  active: "Active",
  paused: "Paused",
  discontinued: "Discontinued",
};

const FLAG_LABEL: Record<string, string> = {
  low: "Low",
  high: "High",
  critical: "Critical",
};

function isFlagged(flag: LabResult["flag"]): boolean {
  return flag === "low" || flag === "high" || flag === "critical";
}

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
        {linkedLabs.map((l) => {
          const flagged = isFlagged(l.flag);
          return (
            <li
              key={l.id}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <span className="min-w-0">
                {flagged ? (
                  <span className="text-muted-foreground">△ </span>
                ) : null}
                {l.marker} · {formatAbsoluteDate(l.resultDate)}
                <span className="ml-2 text-muted-foreground">monitoring</span>
              </span>
              {flagged && l.flag ? <Pill>{FLAG_LABEL[l.flag]}</Pill> : null}
            </li>
          );
        })}
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
