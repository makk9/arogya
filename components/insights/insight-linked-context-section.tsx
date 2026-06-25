import Link from "next/link";

/*
 * §6.9:1628 Linked context — "RELATED INSIGHTS · N", "OTHER PATTERNS WITH
 * [ENTITY] · N". Distinct from Cited sources (§6.9:1611): that's the evidence
 * reasoned over; this is adjacent reasoning.
 *
 * v1 scope: RELATED INSIGHTS has no data model (no insight↔insight relation in
 * the Phase 4 schema — that's a Phase E concern when generation can assert it),
 * so only OTHER PATTERNS WITH [ENTITY] renders. It's derived live: other
 * insights that reference one of this insight's headline `linked_entities` —
 * via their own `linked_entities` OR their `cited_sources` (backlinks computed
 * at render time, never stored — the Phase 3 tripwire). The whole section is
 * omitted when no overlaps exist.
 */

export interface OtherPatternGroup {
  entityLabel: string;
  insights: { id: string; title: string }[];
}

interface Props {
  patientId: string;
  groups: OtherPatternGroup[];
}

export function InsightLinkedContextSection({ patientId, groups }: Props) {
  if (groups.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Linked context
      </h2>
      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <div key={g.entityLabel}>
            <h3 className="mb-1.5 font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">
              Other patterns with {g.entityLabel} · {g.insights.length}
            </h3>
            <ul className="flex flex-col gap-1">
              {g.insights.map((i) => (
                <li key={i.id} className="text-sm leading-relaxed">
                  <Link
                    href={`/patient/${patientId}/insights/${i.id}`}
                    className="text-link underline-offset-2 hover:underline"
                  >
                    {i.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
