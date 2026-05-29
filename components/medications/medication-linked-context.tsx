import { formatAbsoluteDate } from "@/lib/datetime";

export interface LinkedVisitRef {
  id: string;
  visitDate: string;
  doctorName: string;
  visitType: string | null;
}

interface Props {
  linkedVisits: LinkedVisitRef[];
}

/*
 * Linked context per design.md 6.5:1382. Plain link list with light context,
 * not preview cards. Page guards omission when linkedVisits.length === 0 —
 * §6.5 explicitly authorizes omitting the section when empty (LifestyleProfile
 * precedent). Pills are inert until Phase D ships visit detail pages; the
 * `Link` wrapper lands then.
 */
export function MedicationLinkedContext({ linkedVisits }: Props) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Linked context
      </h2>
      <ul className="space-y-2">
        {linkedVisits.map((v) => (
          <li key={v.id} className="text-sm">
            <span className="text-muted-foreground">V</span> Visit · Dr{" "}
            {v.doctorName} · {formatAbsoluteDate(v.visitDate)}
            {v.visitType ? (
              <span className="ml-2 text-muted-foreground">
                · {v.visitType.replace(/_/g, " ")}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
