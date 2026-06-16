import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

/*
 * Empty state per §6.6 page shell — dashed-border placeholder with the
 * `+ Log visit` CTA. Copy per 7.1: plain, forward-looking, no exclamation.
 */
export function VisitEmptyState({ patientId }: { patientId: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <p className="mb-1 text-sm font-medium">No visits on file yet.</p>
      <p className="mx-auto mb-5 max-w-sm text-sm text-muted-foreground">
        Log a doctor visit to start building the timeline — what was discussed,
        what changed, and what comes next.
      </p>
      <Link href={`/patient/${patientId}/visits/new`} className={buttonVariants()}>
        + Log visit
      </Link>
    </div>
  );
}
