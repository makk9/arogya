import type { LabReport, LabResult } from "@/db/schema";

import {
  citationFor,
  compareById,
  formatISODate,
  slugify,
  type SlugIndex,
} from "./format";

export function labReportSlug(report: LabReport): string {
  return `lab-report:${formatISODate(report.reportDate) ?? "unknown"}`;
}

export function labResultSlug(result: LabResult): string {
  const marker = result.markerNormalized ?? result.marker;
  return `lab-result:${slugify(marker)}:${formatISODate(result.resultDate) ?? "unknown"}`;
}

export function serializeLabReports(
  reports: readonly LabReport[],
  results: readonly LabResult[],
  slugIndex: SlugIndex,
): string {
  if (reports.length === 0 && results.length === 0) return "";

  const sortedReports = reports.slice().sort((a, b) => {
    const da = new Date(a.reportDate).getTime();
    const db = new Date(b.reportDate).getTime();
    if (da !== db) return db - da;
    return compareById(a, b);
  });

  const resultsByReport = new Map<string, LabResult[]>();
  const orphans: LabResult[] = [];
  for (const r of results) {
    if (r.labReportId) {
      const list = resultsByReport.get(r.labReportId) ?? [];
      list.push(r);
      resultsByReport.set(r.labReportId, list);
    } else {
      orphans.push(r);
    }
  }

  const lines: string[] = ["# Recent Lab Reports", ""];

  for (const r of sortedReports) {
    const slug = slugIndex.get(r.id) ?? labReportSlug(r);
    lines.push(`## § ${slug}`);
    lines.push("");
    lines.push(`- Report date: ${formatISODate(r.reportDate)}`);
    if (r.reportType) lines.push(`- Type: ${r.reportType}`);
    if (r.labName) lines.push(`- Lab: ${r.labName}`);
    const orderedBy = citationFor(r.orderedBy, slugIndex);
    if (orderedBy) lines.push(`- Ordered by: ${orderedBy}`);
    const linkedVisit = citationFor(r.linkedVisitId, slugIndex);
    if (linkedVisit) lines.push(`- Linked visit: ${linkedVisit}`);
    if (r.summary) lines.push(`- Summary: ${r.summary}`);
    if (r.notes) lines.push(`- Notes: ${r.notes}`);

    const reportResults = (resultsByReport.get(r.id) ?? [])
      .slice()
      .sort((a, b) => {
        const am = (a.markerNormalized ?? a.marker).toLowerCase();
        const bm = (b.markerNormalized ?? b.marker).toLowerCase();
        if (am !== bm) return am < bm ? -1 : 1;
        return compareById(a, b);
      });
    if (reportResults.length > 0) {
      lines.push("");
      lines.push("### Results");
      for (const res of reportResults) {
        lines.push(`- § ${labResultSlug(res)} — ${formatResult(res, slugIndex)}`);
      }
    }
    lines.push("");
  }

  if (orphans.length > 0) {
    const sortedOrphans = orphans.slice().sort((a, b) => {
      const da = new Date(a.resultDate).getTime();
      const db = new Date(b.resultDate).getTime();
      if (da !== db) return db - da;
      return compareById(a, b);
    });
    lines.push("### Unattached results");
    for (const res of sortedOrphans) {
      lines.push(`- § ${labResultSlug(res)} — ${formatResult(res, slugIndex)}`);
    }
  }

  return lines.join("\n").trimEnd();
}

function formatResult(result: LabResult, slugIndex: SlugIndex): string {
  const marker = result.markerNormalized ?? result.marker;
  const value = result.valueText ?? result.value ?? "—";
  const unit = result.unit ? ` ${result.unit}` : "";
  const flag = result.flag ? ` [${result.flag}]` : "";
  const refLow = result.referenceLow;
  const refHigh = result.referenceHigh;
  const range =
    refLow !== null || refHigh !== null
      ? ` (ref ${refLow ?? "—"}–${refHigh ?? "—"})`
      : "";
  const linked = citationFor(result.linkedCondition, slugIndex);
  const linkedTail = linked ? `, linked ${linked}` : "";
  return `${marker}: ${value}${unit}${flag}${range}${linkedTail}`;
}
