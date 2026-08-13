import Link from "next/link";

import type { GlancePreview, PatientAtAGlance } from "@/db/queries/patient";
import { formatAbsoluteDate } from "@/lib/datetime";

interface Props {
  patientId: string;
  counts: PatientAtAGlance;
  // Which vitals are tracked (canonical labels) + total type count — the
  // row's "light context" names what's measured, not how many readings.
  vitals: GlancePreview;
}

/*
 * AT A GLANCE per design.md 6.10:1680 — the meta-summary that replaces the
 * §6.5 "Linked context" naming (1662). A plain link list (§6.5 fenced off
 * "rich preview cards"); the entity rows carry a few sample names as their
 * "light context" instead of a bare count (user decision 2026-06-18) so the
 * reader gets a peek without navigating.
 *
 * Allergies is intentionally absent — it lives in MEDICAL PROFILE (the
 * §6.10 duplication was resolved there). The "Recent insights" row links to
 * the insights feed (§6.8/6.9) now that it has shipped.
 */

const SECTION_HEAD =
  "mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground";

// "Hypertension, Type 2 Diabetes +2" — up to two names then an overflow tail.
// Exported for the dashboard's patient header card, which previews the same
// GlancePreview rows the same way.
export function previewContext(p: GlancePreview, emptyLabel: string): string {
  if (p.count === 0) return emptyLabel;
  if (p.names.length === 0) return String(p.count); // names unavailable, count only
  const shown = p.names.join(", ");
  const overflow = p.count - p.names.length;
  return overflow > 0 ? `${shown} +${overflow}` : shown;
}

function GlanceRow({
  href,
  label,
  context,
}: {
  href: string | null;
  label: string;
  context: string;
}) {
  const body = (
    <>
      <span className="font-medium text-foreground">{label}</span>
      <span className="text-muted-foreground"> · {context}</span>
    </>
  );
  return (
    <li className="border-b border-border/60 py-2 last:border-b-0">
      {href ? (
        <Link
          href={href}
          className="flex items-baseline justify-between gap-3 text-sm underline-offset-4 hover:underline"
        >
          <span className="min-w-0">{body}</span>
          <span aria-hidden className="shrink-0 text-muted-foreground">
            →
          </span>
        </Link>
      ) : (
        <span className="flex items-baseline justify-between gap-3 text-sm">
          {body}
        </span>
      )}
    </li>
  );
}

export function PatientAtAGlanceSection({ patientId, counts, vitals }: Props) {
  const base = `/patient/${patientId}`;
  return (
    <section className="mb-8">
      <h2 className={SECTION_HEAD}>At a glance</h2>
      <ul className="rounded-lg bg-muted/40 px-4 py-1">
        <GlanceRow
          href={`${base}/conditions`}
          label="Conditions"
          context={previewContext(counts.conditions, "none active")}
        />
        <GlanceRow
          href={`${base}/medications`}
          label="Medications"
          context={previewContext(counts.medications, "none active")}
        />
        <GlanceRow
          href={`${base}/doctors`}
          label="Doctors"
          context={previewContext(counts.doctors, "none yet")}
        />
        <GlanceRow
          href={`${base}/family-history`}
          label="Family history"
          context={previewContext(counts.familyHistory, "none recorded")}
        />
        <GlanceRow
          href={`${base}/lifestyle`}
          label="Lifestyle profile"
          context={
            counts.lifestyleUpdatedAt
              ? `last updated ${formatAbsoluteDate(counts.lifestyleUpdatedAt)}`
              : "not recorded yet"
          }
        />
        {/* Vitals history moved here from MEDICAL PROFILE (2026-08-12): it's
            navigation, and this section is the profile's navigation index —
            the context names WHAT's tracked, the medically meaningful bit. */}
        <GlanceRow
          href={`${base}/vitals`}
          label="Vitals history"
          context={previewContext(vitals, "none recorded")}
        />
        <GlanceRow
          href={`${base}/visits`}
          label="Recent visits"
          context={`${counts.recentVisits} in last 30 days`}
        />
        <GlanceRow
          href={`${base}/insights`}
          label="Recent insights"
          context={`${counts.newInsights} new`}
        />
      </ul>
    </section>
  );
}
