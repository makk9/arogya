import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

interface ConditionEmptyStateProps {
  patientId: string;
}

export function ConditionEmptyState({ patientId }: ConditionEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      {/*
        Copy trimmed of the extraction phrasing for the same reason as the
        medication empty state — design.md 6.4:1350 assumes extraction (Phase E)
        ships first, but build sequencing inverted that. Restore the full
        "extract from a report, or add manually" phrasing when extraction lands.
      */}
      <p className="max-w-md text-sm text-muted-foreground">
        No conditions added yet — add manually below.
      </p>
      <Link
        href={`/patient/${patientId}/conditions/new`}
        className={buttonVariants()}
      >
        + Add condition
      </Link>
    </div>
  );
}
