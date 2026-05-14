import type { Medication, MedicationChange } from "@/db/schema";

import {
  citationFor,
  compareById,
  formatISODate,
  slugify,
  type SlugIndex,
} from "./format";

const STATUS_ORDER = ["active", "paused", "discontinued"] as const;

export function medicationSlug(medication: Medication): string {
  return `med:${slugify(medication.name)}`;
}

export function serializeMedications(
  medications: readonly Medication[],
  changes: readonly MedicationChange[],
  slugIndex: SlugIndex,
): string {
  if (medications.length === 0) return "";

  const sorted = medications.slice().sort((a, b) => {
    const sa = STATUS_ORDER.indexOf(a.status);
    const sb = STATUS_ORDER.indexOf(b.status);
    if (sa !== sb) return sa - sb;
    const da = a.startedOn ? new Date(a.startedOn).getTime() : 0;
    const db = b.startedOn ? new Date(b.startedOn).getTime() : 0;
    if (da !== db) return db - da;
    return compareById(a, b);
  });

  const changesByMed = new Map<string, MedicationChange[]>();
  for (const c of changes) {
    const list = changesByMed.get(c.medicationId) ?? [];
    list.push(c);
    changesByMed.set(c.medicationId, list);
  }

  const lines: string[] = ["# Medications", ""];

  for (const m of sorted) {
    lines.push(`## § ${medicationSlug(m)}`);
    lines.push("");
    lines.push(`- Name: ${m.name}`);
    if (m.brandName) lines.push(`- Brand: ${m.brandName}`);
    lines.push(`- Category: ${m.category}`);
    if (m.form) lines.push(`- Form: ${m.form}`);
    lines.push(`- Status: ${m.status}`);
    lines.push(`- Current dose: ${m.currentDose}`);
    lines.push(`- Current frequency: ${m.currentFrequency}`);
    if (m.startedOn) lines.push(`- Started on: ${formatISODate(m.startedOn)}`);
    if (m.discontinuedOn) {
      lines.push(`- Discontinued on: ${formatISODate(m.discontinuedOn)}`);
    }
    if (m.discontinuationReason) {
      lines.push(`- Discontinuation reason: ${m.discontinuationReason}`);
    }
    const purpose = citationFor(m.purpose, slugIndex);
    if (purpose) lines.push(`- Purpose: ${purpose}`);
    const prescriber = citationFor(m.prescribingDoctor, slugIndex);
    if (prescriber) lines.push(`- Prescribed by: ${prescriber}`);
    if (m.notes) lines.push(`- Notes: ${m.notes}`);
    const sourceReport = citationFor(m.sourceReportId, slugIndex);
    if (sourceReport) lines.push(`- Source: ${sourceReport}`);

    const medChanges = (changesByMed.get(m.id) ?? [])
      .slice()
      .sort((c1, c2) => {
        const t = c2.changedAt.getTime() - c1.changedAt.getTime();
        return t !== 0 ? t : compareById(c1, c2);
      });
    if (medChanges.length > 0) {
      lines.push("");
      lines.push("### Changes");
      for (const c of medChanges) {
        const date = formatISODate(c.changedAt);
        const reason = c.reason ? ` (${c.reason})` : "";
        const visit = citationFor(c.linkedVisitId, slugIndex);
        const visitTail = visit ? ` [linked ${visit}]` : "";
        lines.push(
          `- ${date} — ${c.field}: ${c.oldValue ?? "—"} → ${c.newValue ?? "—"}${reason}${visitTail}`,
        );
      }
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
