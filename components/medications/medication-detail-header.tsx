import type { ReactNode } from "react";

import type { Medication } from "@/db/schema";
import { formatAbsoluteDate } from "@/lib/datetime";
import { cn } from "@/lib/utils";

interface Props {
  patientId: string;
  medication: Medication;
  actions: ReactNode | null;
}

// `actions` is null on discontinued meds (the `…` menu's only item is
// Discontinue today; item 5's Edit makes it useful regardless of status).

const STATUS_PILL_CLASS: Record<Medication["status"], string> = {
  active: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  paused: "bg-amber-100 text-amber-800 ring-amber-200",
  discontinued: "bg-stone-200 text-stone-700 ring-stone-300",
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function MedicationDetailHeader({
  patientId,
  medication,
  actions,
}: Props) {
  const subtitleParts: string[] = [];
  if (medication.form) subtitleParts.push(capitalize(medication.form));
  if (medication.startedOn) {
    subtitleParts.push(`started ${formatAbsoluteDate(medication.startedOn)}`);
  }

  return (
    <>
      <nav
        aria-label="breadcrumb"
        className="mb-6 font-mono text-xs text-muted-foreground"
      >
        / patient / {patientId.slice(0, 8)}… / medications /{" "}
        {medication.id.slice(0, 8)}…
      </nav>

      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-heading text-2xl font-semibold leading-tight">
            <span className="border-b-2 border-destructive pb-1">
              {medication.name}
            </span>
            {medication.brandName ? (
              <span className="text-base font-normal text-muted-foreground">
                ({medication.brandName})
              </span>
            ) : null}
            <span
              className={cn(
                "inline-flex items-baseline rounded-full px-2 py-0.5 text-[0.55em] font-medium uppercase tracking-wide ring-1",
                STATUS_PILL_CLASS[medication.status],
              )}
            >
              {medication.status}
            </span>
          </h1>
          {subtitleParts.length > 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {subtitleParts.join(" · ")}
            </p>
          ) : null}
        </div>
        {actions}
      </div>
    </>
  );
}
