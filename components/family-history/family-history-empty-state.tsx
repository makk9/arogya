import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

interface FamilyHistoryEmptyStateProps {
  patientId: string;
}

export function FamilyHistoryEmptyState({
  patientId,
}: FamilyHistoryEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      {/*
        Copy trimmed of the extraction phrasing for the same reason as the
        other empty states — design.md 6.4:1350 assumes extraction (Phase E)
        ships first, but build sequencing inverted that.
      */}
      <p className="max-w-md text-sm text-muted-foreground">
        No family history recorded yet — add what you know, even if it&apos;s
        approximate.
      </p>
      <Link
        href={`/patient/${patientId}/family-history/new`}
        className={buttonVariants()}
      >
        + Add family history
      </Link>
    </div>
  );
}
