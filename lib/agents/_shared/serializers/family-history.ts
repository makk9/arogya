import type { FamilyHistoryEntry, Patient } from "@/db/schema";

import { compareById, slugify } from "./format";

const RELATION_ORDER = [
  "parent",
  "sibling",
  "child",
  "grandparent",
  "aunt_uncle",
  "cousin",
  "other",
] as const;

export function familyHistorySlug(entry: FamilyHistoryEntry): string {
  return `family-history:${slugify(`${entry.relation}-${entry.conditionName}`)}`;
}

export function serializeFamilyHistory(
  patient: Patient,
  entries: readonly FamilyHistoryEntry[],
): string {
  const narrative = patient.familyHistory?.trim() ?? "";
  if (narrative.length === 0 && entries.length === 0) return "";

  const lines: string[] = ["# Family History", ""];

  if (narrative.length > 0) {
    lines.push("### Narrative");
    lines.push(narrative);
    lines.push("");
  }

  if (entries.length > 0) {
    const sorted = entries.slice().sort((a, b) => {
      const ai = RELATION_ORDER.indexOf(a.relation);
      const bi = RELATION_ORDER.indexOf(b.relation);
      if (ai !== bi) return ai - bi;
      return compareById(a, b);
    });

    lines.push("### Entries");
    for (const e of sorted) {
      const relation = e.relationSpecific
        ? `${e.relation} (${e.relationSpecific})`
        : e.relation;
      const onset =
        e.ageOfOnset !== null && e.ageOfOnset !== undefined
          ? `, onset age ${e.ageOfOnset}`
          : "";
      const outcome = e.outcome ? `, outcome: ${e.outcome}` : "";
      const notes = e.notes ? ` — ${e.notes}` : "";
      lines.push(
        `- § ${familyHistorySlug(e)} — ${relation}: ${e.conditionName}${onset}${outcome}${notes}`,
      );
    }
  }

  return lines.join("\n").trimEnd();
}
