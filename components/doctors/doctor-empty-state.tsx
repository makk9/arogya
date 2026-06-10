import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

interface DoctorEmptyStateProps {
  patientId: string;
}

export function DoctorEmptyState({ patientId }: DoctorEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      {/*
        Copy trimmed of the extraction phrasing for the same reason as the
        medication/condition empty states — extraction (Phase E) hasn't shipped
        yet. Restore "let arogya pull them from a prescription, or add manually"
        when it lands.
      */}
      <p className="max-w-md text-sm text-muted-foreground">
        No doctors added yet — add manually below.
      </p>
      <Link
        href={`/patient/${patientId}/doctors/new`}
        className={buttonVariants()}
      >
        + Add doctor
      </Link>
    </div>
  );
}
