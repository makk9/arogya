import type { Visit } from "@/db/schema";

import {
  citationFor,
  compareById,
  formatISODate,
  type SlugIndex,
} from "./format";

export function visitSlug(visit: Visit): string {
  return `visit:${formatISODate(visit.visitDate) ?? "unknown"}`;
}

export function serializeVisits(
  visits: readonly Visit[],
  slugIndex: SlugIndex,
): string {
  if (visits.length === 0) return "";

  const sorted = visits.slice().sort((a, b) => {
    const da = new Date(a.visitDate).getTime();
    const db = new Date(b.visitDate).getTime();
    if (da !== db) return db - da;
    return compareById(a, b);
  });

  const lines: string[] = ["# Recent Visits", ""];

  for (const v of sorted) {
    const slug = slugIndex.get(v.id) ?? visitSlug(v);
    lines.push(`## § ${slug}`);
    lines.push("");
    lines.push(`- Date: ${formatISODate(v.visitDate)}`);
    const doctor = citationFor(v.doctorId, slugIndex);
    if (doctor) lines.push(`- Doctor: ${doctor}`);
    if (v.visitType) lines.push(`- Type: ${v.visitType}`);
    lines.push(`- Status: ${v.status}`);
    if (v.chiefComplaint) lines.push(`- Chief complaint: ${v.chiefComplaint}`);
    if (v.summary) lines.push(`- Summary: ${v.summary}`);
    if (v.diagnosisText) lines.push(`- Diagnosis: ${v.diagnosisText}`);
    if (v.nextSteps) lines.push(`- Next steps: ${v.nextSteps}`);
    if (v.notes) lines.push(`- Notes: ${v.notes}`);
    const sourceReport = citationFor(v.sourceReportId, slugIndex);
    if (sourceReport) lines.push(`- Source: ${sourceReport}`);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
