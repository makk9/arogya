import type { Allergy, AllergyChange } from "@/db/schema";

import {
  citationFor,
  compareById,
  formatISODate,
  slugify,
  type SlugIndex,
} from "./format";

const STATUS_ORDER = ["active", "suspected", "resolved", "disproved"] as const;

export function allergySlug(allergy: Allergy): string {
  return `allergy:${slugify(allergy.substance)}`;
}

export function serializeAllergies(
  allergies: readonly Allergy[],
  changes: readonly AllergyChange[],
  slugIndex: SlugIndex,
): string {
  if (allergies.length === 0) return "";

  const sorted = allergies.slice().sort((a, b) => {
    const sa = STATUS_ORDER.indexOf(a.status);
    const sb = STATUS_ORDER.indexOf(b.status);
    if (sa !== sb) return sa - sb;
    const da = a.firstNoted ? new Date(a.firstNoted).getTime() : 0;
    const db = b.firstNoted ? new Date(b.firstNoted).getTime() : 0;
    if (da !== db) return db - da;
    return compareById(a, b);
  });

  const changesByAllergy = new Map<string, AllergyChange[]>();
  for (const c of changes) {
    const list = changesByAllergy.get(c.allergyId) ?? [];
    list.push(c);
    changesByAllergy.set(c.allergyId, list);
  }

  const lines: string[] = ["# Allergies", ""];

  for (const a of sorted) {
    lines.push(`## § ${allergySlug(a)}`);
    lines.push("");
    lines.push(`- Substance: ${a.substance}`);
    lines.push(`- Category: ${a.category}`);
    lines.push(`- Status: ${a.status}`);
    if (a.severity) lines.push(`- Severity: ${a.severity}`);
    if (a.reaction) lines.push(`- Reaction: ${a.reaction}`);
    if (a.firstNoted) lines.push(`- First noted: ${formatISODate(a.firstNoted)}`);
    const confirmedBy = citationFor(a.confirmedBy, slugIndex);
    if (confirmedBy) lines.push(`- Confirmed by: ${confirmedBy}`);
    if (a.notes) lines.push(`- Notes: ${a.notes}`);

    const allergyChanges = (changesByAllergy.get(a.id) ?? [])
      .slice()
      .sort((c1, c2) => {
        const t = c2.changedAt.getTime() - c1.changedAt.getTime();
        return t !== 0 ? t : compareById(c1, c2);
      });
    if (allergyChanges.length > 0) {
      lines.push("");
      lines.push("### Changes");
      for (const c of allergyChanges) {
        const date = formatISODate(c.changedAt);
        const reason = c.reason ? ` (${c.reason})` : "";
        lines.push(
          `- ${date} — ${c.field}: ${c.oldValue ?? "—"} → ${c.newValue ?? "—"}${reason}`,
        );
      }
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
