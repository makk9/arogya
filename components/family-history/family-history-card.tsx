import Link from "next/link";

import { RELATION_LABEL } from "@/components/family-history/family-history-options";
import type { FamilyHistoryEntry } from "@/db/schema";

interface FamilyHistoryCardProps {
  patientId: string;
  entry: FamilyHistoryEntry;
}

/*
 * Family history list-card per the §6.4:1322 locked sketch:
 *   line 1: [relation specific]                       [relation type pill]
 *   line 2: [condition_name] · age [age_of_onset]
 *   line 3: [outcome if set]
 *
 * When relationSpecific is empty, line 1 falls back to the relation label so
 * the bold line never goes blank (the pill then reads slightly redundant —
 * acceptable, same trade-off as the Doctor card's specialty pill §6.4:1368).
 */
export function FamilyHistoryCard({ patientId, entry }: FamilyHistoryCardProps) {
  const relationLabel = RELATION_LABEL[entry.relation] ?? entry.relation;
  const title = entry.relationSpecific ?? relationLabel;

  const lineTwoParts: string[] = [entry.conditionName];
  if (entry.ageOfOnset !== null) {
    lineTwoParts.push(`age ${entry.ageOfOnset}`);
  }

  return (
    <Link
      href={`/patient/${patientId}/family-history/${entry.id}`}
      className="block rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-foreground/30 hover:bg-muted/40"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{title}</span>
        <Pill>{relationLabel}</Pill>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {lineTwoParts.join(" · ")}
      </div>
      {entry.outcome ? (
        <div className="mt-1 text-xs text-muted-foreground">{entry.outcome}</div>
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
