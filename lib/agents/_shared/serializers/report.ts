import type { Report } from "@/db/schema";

import {
  citationFor,
  compareById,
  formatISODate,
  type SlugIndex,
} from "./format";

export function reportSlug(report: Report): string {
  return `report:${formatISODate(report.reportDate) ?? "unknown"}`;
}

export function serializeReports(
  reports: readonly Report[],
  slugIndex: SlugIndex,
): string {
  if (reports.length === 0) return "";

  const sorted = reports.slice().sort((a, b) => {
    const da = new Date(a.reportDate).getTime();
    const db = new Date(b.reportDate).getTime();
    if (da !== db) return db - da;
    return compareById(a, b);
  });

  const lines: string[] = ["# Recent Reports", ""];

  for (const r of sorted) {
    const slug = slugIndex.get(r.id) ?? reportSlug(r);
    lines.push(`## § ${slug}`);
    lines.push("");
    lines.push(`- Title: ${r.title}`);
    lines.push(`- Date: ${formatISODate(r.reportDate)}`);
    if (r.reportType) lines.push(`- Type: ${r.reportType}`);
    lines.push(`- Status: ${r.status}`);
    const linkedVisit = citationFor(r.linkedVisitId, slugIndex);
    if (linkedVisit) lines.push(`- Linked visit: ${linkedVisit}`);
    const linkedDoctor = citationFor(r.linkedDoctorId, slugIndex);
    if (linkedDoctor) lines.push(`- Linked doctor: ${linkedDoctor}`);
    if (r.content) lines.push(`- Content: ${r.content}`);
    if (r.notes) lines.push(`- Notes: ${r.notes}`);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
