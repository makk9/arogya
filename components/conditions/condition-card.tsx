import Link from "next/link";

import {
  CATEGORY_OPTIONS,
  STATUS_OPTIONS,
} from "@/components/conditions/condition-options";
import type { Condition, Doctor } from "@/db/schema";
import { formatAbsoluteDate } from "@/lib/datetime";

interface ConditionCardProps {
  patientId: string;
  condition: Condition;
  doctor: Doctor | undefined;
  medCount: number;
  labCount: number;
}

// Value→label lookups built from the shared option lists so pill text matches
// the form's wording (single source of truth in condition-options.ts).
const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
);
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
);

/*
 * Condition list-card per design.md 6.4. Three lines:
 *   line 1: [name]                                    [category pill]
 *   line 2: since [date] · managed by [Dr · specialty]   [status pill]
 *   line 3: [N medications · N labs monitoring]
 *
 * The managing-doctor reference renders as inert text (no Link) this round —
 * the Doctor detail page lands later in Phase D; until then the link target
 * doesn't exist, mirroring how the Medication card treats its doctor/condition
 * refs. Pills are neutral (semantic tokens only): the brand accent is still
 * stone-only/deferred, so status/category are NOT color-coded here.
 */
export function ConditionCard({
  patientId,
  condition,
  doctor,
  medCount,
  labCount,
}: ConditionCardProps) {
  const lineTwoParts: string[] = [];
  if (condition.diagnosedOn) {
    lineTwoParts.push(`since ${formatAbsoluteDate(condition.diagnosedOn)}`);
  }
  if (doctor) {
    lineTwoParts.push(`managed by Dr ${doctor.name} · ${doctor.specialty}`);
  }

  const linkedParts: string[] = [];
  if (medCount > 0) {
    linkedParts.push(`${medCount} ${medCount === 1 ? "medication" : "medications"}`);
  }
  if (labCount > 0) {
    linkedParts.push(`${labCount} ${labCount === 1 ? "lab" : "labs"} monitoring`);
  }

  const categoryLabel = condition.category
    ? CATEGORY_LABEL[condition.category]
    : null;

  return (
    <Link
      href={`/patient/${patientId}/conditions/${condition.id}`}
      className="block rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-foreground/30 hover:bg-muted/40"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{condition.name}</span>
        {categoryLabel ? <Pill>{categoryLabel}</Pill> : null}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {lineTwoParts.join(" · ")}
        </span>
        <Pill>{STATUS_LABEL[condition.status] ?? condition.status}</Pill>
      </div>
      {linkedParts.length > 0 ? (
        <div className="mt-1 text-xs text-muted-foreground">
          {linkedParts.join(" · ")}
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
