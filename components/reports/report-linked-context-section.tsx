import Link from "next/link";

import type { Visit } from "@/db/schema";
import { formatAbsoluteDate } from "@/lib/datetime";

/*
 * The §6.7 Linked context section for a Report — "linked visit, linked
 * conditions". v1 surfaces the linked VISIT (reports.linked_visit_id): the
 * encounter this document came out of, with a link to the visit detail.
 *
 * "Linked conditions" from the spec is satisfied by the Outcomes section
 * (conditions carrying source_report_id) — the Phase 4 schema has no separate
 * condition↔report edge, so there's nothing else to surface here (interpretation
 * flagged in decisions.md). The linked doctor (author/source) lives in the
 * header subtitle, not here. Parent omits the section when there's no linked
 * visit.
 */

interface Props {
  patientId: string;
  linkedVisit: Visit | null;
  linkedVisitDoctorName: string | null;
}

export function ReportLinkedContextSection({
  patientId,
  linkedVisit,
  linkedVisitDoctorName,
}: Props) {
  if (!linkedVisit) return null;

  const who = linkedVisitDoctorName ?? "Visit";

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Linked context
      </h2>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-muted-foreground">This report came from</p>
        <Link
          href={`/patient/${patientId}/visits/${linkedVisit.id}`}
          className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm transition-colors hover:border-foreground/30 hover:bg-muted/40"
        >
          <span className="font-medium">{who}</span>
          <span className="text-muted-foreground">
            {" "}
            · {formatAbsoluteDate(linkedVisit.visitDate)}
          </span>
        </Link>
      </div>
    </section>
  );
}
