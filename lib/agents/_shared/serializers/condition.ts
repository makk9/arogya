import type { Condition, ConditionChange } from "@/db/schema";

import {
  citationFor,
  compareById,
  formatISODate,
  slugify,
  type SlugIndex,
} from "./format";

const STATUS_ORDER = [
  "active",
  "controlled",
  "in_remission",
  "suspected",
  "resolved",
] as const;

export function conditionSlug(condition: Condition): string {
  return `condition:${slugify(condition.name)}`;
}

export function serializeConditions(
  conditions: readonly Condition[],
  changes: readonly ConditionChange[],
  slugIndex: SlugIndex,
): string {
  if (conditions.length === 0) return "";

  const sorted = conditions.slice().sort((a, b) => {
    const sa = STATUS_ORDER.indexOf(a.status);
    const sb = STATUS_ORDER.indexOf(b.status);
    if (sa !== sb) return sa - sb;
    const da = a.diagnosedOn ? new Date(a.diagnosedOn).getTime() : 0;
    const db = b.diagnosedOn ? new Date(b.diagnosedOn).getTime() : 0;
    if (da !== db) return db - da;
    return compareById(a, b);
  });

  const changesByCondition = new Map<string, ConditionChange[]>();
  for (const c of changes) {
    const list = changesByCondition.get(c.conditionId) ?? [];
    list.push(c);
    changesByCondition.set(c.conditionId, list);
  }

  const lines: string[] = ["# Conditions", ""];

  for (const c of sorted) {
    lines.push(`## § ${conditionSlug(c)}`);
    lines.push("");
    lines.push(`- Name: ${c.name}`);
    lines.push(`- Status: ${c.status}`);
    if (c.category) lines.push(`- Category: ${c.category}`);
    if (c.severity) lines.push(`- Severity: ${c.severity}`);
    if (c.icdCode) lines.push(`- ICD code: ${c.icdCode}`);
    if (c.diagnosedOn) {
      lines.push(`- Diagnosed on: ${formatISODate(c.diagnosedOn)}`);
    }
    const diagnosedBy = citationFor(c.diagnosedBy, slugIndex);
    if (diagnosedBy) lines.push(`- Diagnosed by: ${diagnosedBy}`);
    const managingDoctor = citationFor(c.managingDoctor, slugIndex);
    if (managingDoctor) lines.push(`- Managing doctor: ${managingDoctor}`);
    if (c.notes) lines.push(`- Notes: ${c.notes}`);
    const sourceReport = citationFor(c.sourceReportId, slugIndex);
    if (sourceReport) lines.push(`- Source: ${sourceReport}`);

    const conditionChanges = (changesByCondition.get(c.id) ?? [])
      .slice()
      .sort((c1, c2) => {
        const t = c2.changedAt.getTime() - c1.changedAt.getTime();
        return t !== 0 ? t : compareById(c1, c2);
      });
    if (conditionChanges.length > 0) {
      lines.push("");
      lines.push("### Changes");
      for (const ch of conditionChanges) {
        const date = formatISODate(ch.changedAt);
        const reason = ch.reason ? ` (${ch.reason})` : "";
        lines.push(
          `- ${date} — ${ch.field}: ${ch.oldValue ?? "—"} → ${ch.newValue ?? "—"}${reason}`,
        );
      }
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
