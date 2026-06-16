import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

/*
 * Empty state per §6.6 page shell — dashed-border placeholder with the
 * `+ Log lab report` CTA. Copy per 7.1: plain, forward-looking, no exclamation.
 */
export function LabEmptyState({ patientId }: { patientId: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <p className="mb-1 text-sm font-medium">No lab reports on file yet.</p>
      <p className="mx-auto mb-5 max-w-sm text-sm text-muted-foreground">
        Log a lab report to start tracking markers over time — values, reference
        ranges, and what each result monitors.
      </p>
      <Link
        href={`/patient/${patientId}/labs/new`}
        className={buttonVariants()}
      >
        + Log lab report
      </Link>
    </div>
  );
}
