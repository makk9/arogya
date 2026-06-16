import Link from "next/link";

import { formatAbsoluteDate } from "@/lib/datetime";
import { EntityTypeGlyph } from "@/components/entity-type-glyph";
import { VISIT_TYPE_LABEL } from "@/components/visits/visit-options";
import { displayDoctorName } from "@/lib/doctor-display";

export interface LinkedVisitRef {
  id: string;
  visitDate: string;
  doctorName: string;
  visitType: string | null;
}

interface Props {
  patientId: string;
  linkedVisits: LinkedVisitRef[];
}

/*
 * Linked context per design.md 6.5:1382. Plain link list with light context,
 * not preview cards. Page guards omission when linkedVisits.length === 0 —
 * §6.5 explicitly authorizes omitting the section when empty (LifestyleProfile
 * precedent). Rows link to the visit detail page (Phase D Visit vertical).
 */
export function MedicationLinkedContext({ patientId, linkedVisits }: Props) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Linked context
      </h2>
      <ul className="space-y-2">
        {linkedVisits.map((v) => (
          <li key={v.id} className="text-sm">
            <Link
              href={`/patient/${patientId}/visits/${v.id}`}
              className="underline-offset-4 hover:underline"
            >
              <EntityTypeGlyph letter="V" />
              Visit · {displayDoctorName(v.doctorName)} ·{" "}
              {formatAbsoluteDate(v.visitDate)}
              {v.visitType ? (
                <span className="ml-2 text-muted-foreground">
                  · {VISIT_TYPE_LABEL[v.visitType] ?? v.visitType}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
