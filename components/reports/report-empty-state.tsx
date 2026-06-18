import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

/*
 * Empty state per §6.6 page shell — dashed-border placeholder with the
 * `+ Log report` CTA. Copy per 7.1: plain, forward-looking, no exclamation.
 */
export function ReportEmptyState({ patientId }: { patientId: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <p className="mb-1 text-sm font-medium">No reports on file yet.</p>
      <p className="mx-auto mb-5 max-w-sm text-sm text-muted-foreground">
        Log a document — a discharge summary, doctor letter, prescription, or
        imaging report — to keep it with the record.
      </p>
      <Link href={`/patient/${patientId}/reports/new`} className={buttonVariants()}>
        + Log report
      </Link>
    </div>
  );
}
