import Link from "next/link";

import type { InsightCitedSource } from "@/db/schema";

/*
 * §6.9:1627 Cited sources — "plain link list grouped by reference type"
 * (`MEDICATIONS · 1`, `SYMPTOM EPISODES · 5`, …). This is the evidence the
 * insight reasoned over (distinct from Linked context, §6.9:1611). Each source
 * renders its stored `snippet` as the row text; rows whose entity has a detail
 * page link to it, the rest (e.g. vital readings — create-only, no detail page)
 * render as inert text. The §1.2 traceability commitment made visible.
 *
 * Omitted entirely when an insight cites nothing.
 */

// type → uppercase group header. Ordered so headers render in a stable,
// clinically-sensible sequence regardless of cited_sources insertion order.
const GROUP_ORDER: ReadonlyArray<{ type: string; header: string }> = [
  { type: "med", header: "Medications" },
  { type: "condition", header: "Conditions" },
  { type: "symptom", header: "Symptom types" },
  { type: "symptom-episode", header: "Symptom episodes" },
  { type: "vital", header: "Vital readings" },
  { type: "visit", header: "Visits" },
  { type: "lab-report", header: "Lab reports" },
  { type: "report", header: "Reports" },
  { type: "doctor", header: "Doctors" },
  { type: "allergy", header: "Allergies" },
  { type: "family-history", header: "Family history" },
];

interface Props {
  sources: InsightCitedSource[];
  /** `${type}:${id}` → detail href, for sources whose entity has a page. */
  hrefByKey: Map<string, string>;
}

export function InsightCitedSourcesSection({ sources, hrefByKey }: Props) {
  if (sources.length === 0) return null;

  const byType = new Map<string, InsightCitedSource[]>();
  for (const s of sources) {
    const arr = byType.get(s.type) ?? [];
    arr.push(s);
    byType.set(s.type, arr);
  }

  // Known types first (in GROUP_ORDER), then any unrecognized type appended so
  // nothing is silently dropped from the traceability list.
  const orderedTypes = [
    ...GROUP_ORDER.filter((g) => byType.has(g.type)),
    ...[...byType.keys()]
      .filter((t) => !GROUP_ORDER.some((g) => g.type === t))
      .map((t) => ({ type: t, header: t })),
  ];

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Cited sources
      </h2>
      <div className="flex flex-col gap-4">
        {orderedTypes.map(({ type, header }) => {
          const items = byType.get(type) ?? [];
          return (
            <div key={type}>
              <h3 className="mb-1.5 font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                {header} · {items.length}
              </h3>
              <ul className="flex flex-col gap-1">
                {items.map((s) => {
                  const href = hrefByKey.get(`${s.type}:${s.id}`);
                  return (
                    <li key={`${s.type}:${s.id}`} className="text-sm leading-relaxed">
                      {href ? (
                        <Link
                          href={href}
                          className="text-link underline-offset-2 hover:underline"
                        >
                          {s.snippet}
                        </Link>
                      ) : (
                        <span className="text-foreground">{s.snippet}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
