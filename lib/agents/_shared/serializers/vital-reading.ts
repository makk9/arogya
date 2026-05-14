import type { VitalReading } from "@/db/schema";

import {
  citationFor,
  compareById,
  formatISODate,
  type SlugIndex,
} from "./format";

export function vitalReadingSlug(reading: VitalReading): string {
  return `vital:${reading.readingType}:${formatISODate(reading.recordedAt) ?? "unknown"}`;
}

export function serializeVitalReadings(
  readings: readonly VitalReading[],
  slugIndex: SlugIndex,
): string {
  if (readings.length === 0) return "";

  const byType = new Map<string, VitalReading[]>();
  for (const r of readings) {
    const list = byType.get(r.readingType) ?? [];
    list.push(r);
    byType.set(r.readingType, list);
  }

  const lines: string[] = ["# Recent Vital Readings", ""];

  const typeNames = [...byType.keys()].sort();

  for (const type of typeNames) {
    const typeReadings = byType.get(type)!.slice().sort((a, b) => {
      const ta = a.recordedAt.getTime();
      const tb = b.recordedAt.getTime();
      if (ta !== tb) return tb - ta;
      return compareById(a, b);
    });

    lines.push(`## ${type}`);
    lines.push("");
    for (const r of typeReadings) {
      const slug = slugIndex.get(r.id) ?? vitalReadingSlug(r);
      const value = formatVitalValue(r);
      const flag = r.flag ? ` [${r.flag}]` : "";
      const context = r.context ? `, ${r.context}` : "";
      const linked = citationFor(r.linkedSymptomId, slugIndex);
      const linkedTail = linked ? `, linked ${linked}` : "";
      const notes = r.notes ? ` — ${r.notes}` : "";
      lines.push(
        `- § ${slug} — ${formatISODate(r.recordedAt)}: ${value}${flag}${context}${linkedTail}${notes}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function formatVitalValue(r: VitalReading): string {
  const primary = r.valuePrimary;
  const secondary = r.valueSecondary;
  if (primary !== null && secondary !== null) {
    return `${primary}/${secondary} ${r.unit}`;
  }
  if (primary !== null) {
    return `${primary} ${r.unit}`;
  }
  return `— ${r.unit}`;
}
