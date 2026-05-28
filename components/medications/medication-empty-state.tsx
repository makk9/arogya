import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

interface MedicationEmptyStateProps {
  patientId: string;
}

export function MedicationEmptyState({ patientId }: MedicationEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      {/*
        Copy intentionally trimmed from design.md 6.4:1350 — the spec assumes
        extraction (Phase E) ships before the list page (Phase C), but build
        sequencing inverted that. Restoring the full "extract from a
        prescription photo, or add manually" phrasing when extraction lands.
      */}
      <p className="max-w-md text-sm text-muted-foreground">
        No medications added yet — add manually below.
      </p>
      <Link
        href={`/patient/${patientId}/medications/new`}
        className={buttonVariants()}
      >
        + Add medication
      </Link>
    </div>
  );
}
