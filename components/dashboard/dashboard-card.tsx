import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/*
 * Shared chrome for the §6.1 dashboard summary cards: SECTION-style header row
 * (same font-mono uppercase idiom as the profile sections) with an optional
 * trailing action link, over a bordered card body. The empty variant renders
 * the §6.1:1173 dashed treatment — iconless one-liner + a single CTA — so a
 * data-less card reads as "waiting for data," not broken. (The activation
 * banner and setup counter are Phase F; this is only the per-card pattern.)
 */

export function DashboardCard({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: { label: string; href: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-card", className)}>
      <header className="flex items-baseline justify-between gap-3 border-b border-border/60 px-4 py-2.5">
        <h2 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        {action ? (
          <Link
            href={action.href}
            className="shrink-0 text-xs text-link underline-offset-4 hover:underline"
          >
            {action.label}
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function DashboardCardEmpty({
  headline,
  explanation,
  cta,
}: {
  headline: string;
  explanation: string;
  cta: { label: string; href: string };
}) {
  return (
    <div className="m-3 flex flex-col items-start gap-2 rounded-md border border-dashed border-border px-4 py-5">
      <p className="text-sm font-medium text-foreground">{headline}</p>
      <p className="text-sm text-muted-foreground">{explanation}</p>
      <Link
        href={cta.href}
        className="mt-1 text-sm text-link underline-offset-4 hover:underline"
      >
        {cta.label} →
      </Link>
    </div>
  );
}
