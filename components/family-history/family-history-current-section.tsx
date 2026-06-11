"use client";

import { RELATION_LABEL } from "@/components/family-history/family-history-options";
import { FamilyHistoryInlineField } from "@/components/family-history/family-history-inline-field";
import type { FamilyHistoryEntry } from "@/db/schema";

interface Props {
  entry: FamilyHistoryEntry;
}

/*
 * Current section per design.md 6.5:1380 + FamilyHistory emphasis (6.5:1404:
 * relation, relation_specific, condition_name, age_of_onset, outcome —
 * condition_name is the H1, see header note). Prominent cards: who
 * (relation_specific) + age of onset. Compact grid: relation type / outcome.
 *
 * No `+ Log a change` hint and no locked fields — every field is plain
 * inline-editable (no change log per §4:558). Clones
 * allergy-current-section.tsx minus the log-change plumbing.
 */

const SECTION_HEAD =
  "mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground";
const FIELD_LABEL =
  "mb-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground";

export function FamilyHistoryCurrentSection({ entry }: Props) {
  const relationLabel = RELATION_LABEL[entry.relation] ?? entry.relation;

  return (
    <section className="mb-8">
      <h2 className={SECTION_HEAD}>Current</h2>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-2xl font-semibold leading-tight">
            <FamilyHistoryInlineField
              fieldKey="relationSpecific"
              value={entry.relationSpecific}
              variant="text"
              required={false}
              clearable
              ariaLabel="Relation specific"
              placeholder="Father, older brother…"
              displayValue={
                entry.relationSpecific ?? (
                  <span className="text-muted-foreground">{relationLabel}</span>
                )
              }
            />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">who</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-2xl font-semibold leading-tight">
            <FamilyHistoryInlineField
              fieldKey="ageOfOnset"
              value={entry.ageOfOnset !== null ? String(entry.ageOfOnset) : null}
              variant="number"
              required={false}
              clearable
              ariaLabel="Age of onset"
              placeholder="65"
              displayValue={
                entry.ageOfOnset !== null ? (
                  String(entry.ageOfOnset)
                ) : (
                  <span className="text-muted-foreground">—</span>
                )
              }
            />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">age of onset</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted/40 px-4 py-3">
        <div>
          <div className={FIELD_LABEL}>relation</div>
          <FamilyHistoryInlineField
            fieldKey="relation"
            value={entry.relation}
            variant="select-relation"
            required
            clearable={false}
            ariaLabel="Relation"
            displayValue={<span className="text-sm">{relationLabel}</span>}
          />
        </div>
        <div>
          <div className={FIELD_LABEL}>outcome</div>
          <FamilyHistoryInlineField
            fieldKey="outcome"
            value={entry.outcome}
            variant="text"
            required={false}
            clearable
            ariaLabel="Outcome"
            placeholder="Passed at 78 from MI…"
            displayValue={
              <span className="text-sm">
                {entry.outcome ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>
            }
          />
        </div>
      </div>
    </section>
  );
}
