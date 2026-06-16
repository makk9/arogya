import Link from "next/link";

import type { OutcomeItem } from "@/components/visits/visit-outcome-model";
import { cn } from "@/lib/utils";

/*
 * The §6.7 Outcomes section — what changed because of this event. Replaces the
 * state template's History (events have no change log). Each §6.6 result badge
 * expands into a full row: glyph + action description, the italicized quoted
 * reason when one was recorded, and a link-out to the affected entity.
 *
 * One row max renders in the warm tint (`significant` from the outcome model);
 * the rest stay neutral — §6.7's "soft tint on clinically significant
 * outcomes". Tint rides `--accent` (no terra token in the palette yet).
 *
 * Parent omits the section entirely when there are no outcomes (§6.5:1386
 * omission rationale): outcome links are created from the entities themselves
 * (e.g. the med-change dialog's "Linked visit" select), so an empty section
 * has no call to action here.
 */

interface Props {
  outcomes: OutcomeItem[];
}

export function VisitOutcomesSection({ outcomes }: Props) {
  if (outcomes.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Outcomes
      </h2>
      <div className="flex flex-col gap-2">
        {outcomes.map((o) => (
          <div
            key={o.key}
            className={cn(
              "rounded-lg border px-4 py-3",
              o.significant
                ? "border-accent-foreground/25 bg-accent/50"
                : "border-border bg-card",
            )}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">
                <span aria-hidden className="mr-1.5 font-mono">
                  {o.glyph}
                </span>
                {o.text}
              </span>
              {o.href && o.linkLabel ? (
                <Link
                  href={o.href}
                  className="shrink-0 text-xs text-link underline-offset-4 hover:underline"
                >
                  {o.linkLabel}
                </Link>
              ) : null}
            </div>
            {o.reason ? (
              <p className="mt-1 text-xs italic text-muted-foreground">
                &ldquo;{o.reason}&rdquo;
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
