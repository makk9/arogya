import Link from "next/link";

import { STATUS_OPTIONS } from "@/components/conditions/condition-options";
import type { Condition } from "@/db/schema";

interface Props {
  patientId: string;
  /** The patient's own conditions whose names match this entry's condition. */
  matches: ReadonlyArray<Condition>;
}

const CONDITION_STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
);

/*
 * Linked context per design.md 6.5:1404 — "could surface the patient's own
 * conditions that match the family pattern (e.g. 'Patient also has
 * Hypertension')". Matching is a render-time name comparison (backlinks are
 * derived, never stored — Phase 3 tripwire); the page computes matches and
 * passes them in. Section is omitted entirely when there are no matches
 * (§6.5:1386 — better than an empty dashed box).
 *
 * Plain link list with light context per §6.5:1382 — title + status pill.
 */
export function FamilyHistoryLinkedContext({ patientId, matches }: Props) {
  if (matches.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Linked context
      </h2>
      <ul className="flex flex-col gap-1">
        {matches.map((c) => (
          <li key={c.id}>
            <Link
              href={`/patient/${patientId}/conditions/${c.id}`}
              className="flex items-baseline justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2.5 transition-colors hover:border-foreground/30 hover:bg-muted/40"
            >
              <span className="text-sm">
                {patientPossessive(c.name)}
              </span>
              <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[0.7rem] text-muted-foreground">
                {CONDITION_STATUS_LABEL[c.status] ?? c.status}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// "Patient also has Hypertension" framing from §6.5:1404, without the
// forbidden word "patient" (7.1 pronouns) — the entity name carries it.
function patientPossessive(conditionName: string): string {
  return `Also in this record: ${conditionName}`;
}
