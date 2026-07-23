import Link from "next/link";
import type { ReactNode } from "react";

/*
 * Shared breadcrumb for patient sub-pages — the §6.7 path trail
 * (`/ patient / 75794434… / visits / 2026-05-08`). Every segment that has a
 * destination is a live link; the current page (the last segment) is inert and
 * carries aria-current. Previously each header/page hand-rendered this trail as
 * plain text, so there was no way to click back up the tree.
 *
 * Callers pass only the `trail` beyond the patient root — the `patient / id…`
 * prefix is rendered here. A trail item's `href` is RELATIVE to the patient
 * root (e.g. "visits" → /patient/{id}/visits); omit it for the current segment
 * or for a segment with no page of its own.
 */

export interface Crumb {
  label: string;
  href?: string;
}

const LINK_CLASS = "underline-offset-4 hover:text-foreground hover:underline";

export function Breadcrumb({
  patientId,
  trail = [],
}: {
  patientId: string;
  trail?: Crumb[];
}) {
  const hasTrail = trail.length > 0;

  const segments: ReactNode[] = [
    hasTrail ? (
      <Link key="patient" href={`/patient/${patientId}`} className={LINK_CLASS}>
        patient
      </Link>
    ) : (
      <span key="patient">patient</span>
    ),
    <span key="id" aria-current={hasTrail ? undefined : "page"}>
      {patientId.slice(0, 8)}…
    </span>,
  ];

  trail.forEach((item, i) => {
    const isLast = i === trail.length - 1;
    segments.push(
      item.href && !isLast ? (
        <Link
          key={`t${i}`}
          href={`/patient/${patientId}/${item.href}`}
          className={LINK_CLASS}
        >
          {item.label}
        </Link>
      ) : (
        <span key={`t${i}`} aria-current={isLast ? "page" : undefined}>
          {item.label}
        </span>
      ),
    );
  });

  return (
    <nav
      aria-label="breadcrumb"
      className="mb-6 font-mono text-xs text-muted-foreground"
    >
      {segments.map((seg, i) => (
        <span key={i}>
          {i === 0 ? "/ " : " / "}
          {seg}
        </span>
      ))}
    </nav>
  );
}
