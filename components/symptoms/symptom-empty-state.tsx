import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

/*
 * Empty state per §6.6 page shell — dashed-border placeholder with the
 * `+ Log symptom` CTA. Copy per 7.1: plain, forward-looking, no exclamation.
 */
export function SymptomEmptyState({ patientId }: { patientId: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <p className="mb-1 text-sm font-medium">No symptoms tracked yet.</p>
      <p className="mx-auto mb-5 max-w-sm text-sm text-muted-foreground">
        Log a symptom episode — dizziness, swelling, a headache — and arogya
        groups repeat occurrences so patterns over time become visible.
      </p>
      <Link href={`/patient/${patientId}/symptoms/new`} className={buttonVariants()}>
        + Log symptom
      </Link>
    </div>
  );
}
