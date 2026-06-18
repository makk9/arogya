import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

/*
 * Empty state per §6.6 page shell — dashed-border placeholder with the
 * `+ New entry` CTA. Copy per 7.1: plain, personal (this is the user's own
 * writing), no exclamation.
 */
export function JournalEmptyState({ patientId }: { patientId: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <p className="mb-1 text-sm font-medium">Nothing written yet.</p>
      <p className="mx-auto mb-5 max-w-sm text-sm text-muted-foreground">
        The journal is for whatever doesn&apos;t fit a structured field —
        observations, questions, how things are going.
      </p>
      <Link href={`/patient/${patientId}/journal/new`} className={buttonVariants()}>
        + New entry
      </Link>
    </div>
  );
}
