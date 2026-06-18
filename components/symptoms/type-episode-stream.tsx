import Link from "next/link";

import type { ReactNode } from "react";

/*
 * The episode stream on the SymptomType detail page — the "stable identity + a
 * stream of episodes" half of the labs-style pattern (§4:437), here shown on the
 * parent's page. Cards are server-rendered (SymptomEpisodeCard) and passed in;
 * this is a plain section (no collapse — one type's episodes, newest first).
 */

interface Props {
  patientId: string;
  typeId: string;
  count: number;
  cards: ReactNode;
}

export function TypeEpisodeStream({ patientId, typeId, count, cards }: Props) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          Episodes · {count}
        </h2>
        {/* Carries the type id so the form locks the Symptom to this type
            (logging an episode FOR this symptom — §6.7 parent context). */}
        <Link
          href={`/patient/${patientId}/symptoms/new?type=${typeId}`}
          className="font-mono text-xs text-link underline-offset-4 hover:underline"
        >
          + Log episode →
        </Link>
      </div>
      {count > 0 ? (
        <div className="flex flex-col gap-2">{cards}</div>
      ) : (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No episodes logged for this symptom yet.
        </p>
      )}
    </section>
  );
}
