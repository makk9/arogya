import { and, asc, desc, eq, lt, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  conditions,
  labReports,
  labResults,
  type Condition,
  type LabReport,
  type LabResult,
  type NewLabReport,
  type NewLabResult,
} from "@/db/schema";
import { formatISODate, slugify } from "@/lib/agents/_shared/serializers/format";
import { conditionInScope, doctorInScope, visitInScope } from "./_shared";

/*
 * Lab queries — the second EVENT entity (§6.6/§6.7) and the first one→many
 * split: one LabReport (the document) owns many LabResults (the measured
 * markers). The report is the timeline/detail unit; results render as the
 * read-only MARKERS table (§6.7 — corrections amend a row in place, there is no
 * `lab_results_changes` table).
 *
 * Patient scope rides patient_id on both tables (denormalized onto lab_results
 * for fast time-series per §4:392), so a foreign reportId / resultId can never
 * surface another patient's rows.
 */

// Report-level columns editable via PATCH (§6.7 Edit). The MARKERS table is NOT
// in this set — results are corrected through correctResult(), never the report
// PATCH. sourceFileUrl / sourceReportId are written by the Phase E extraction
// pipeline, never by direct entry, so they're omitted too.
type LabReportUpdate = Partial<
  Pick<
    NewLabReport,
    | "reportDate"
    | "reportType"
    | "labName"
    | "orderedBy"
    | "linkedVisitId"
    | "summary"
    | "notes"
  >
>;

// A single marker on the correction form (§6.7 `+ Log a correction`). Marker
// identity (which row) is the path param; only the measured fields amend.
export type LabResultCorrection = Partial<
  Pick<
    NewLabResult,
    | "value"
    | "valueText"
    | "unit"
    | "referenceLow"
    | "referenceHigh"
    | "flag"
  >
>;

// A marker row as it arrives from the create form, before the report's id and
// denormalized patient_id / result_date are stamped on.
export interface NewLabResultInput {
  marker: string;
  markerNormalized?: string | null;
  value?: string | null;
  valueText?: string | null;
  unit?: string | null;
  referenceLow?: string | null;
  referenceHigh?: string | null;
  flag?: LabResult["flag"];
  linkedCondition?: string | null;
}

// Domain error kinds:
//  - not_found             — patient-scoped lookup missed
//  - linked_entity_invalid — orderedBy / linkedVisitId / a result's
//                            linkedCondition is out of patient scope
//                            (reason: doctor_not_found / visit_not_found /
//                            condition_not_found)
export class LabDomainError extends Error {
  constructor(
    public readonly kind: "not_found" | "linked_entity_invalid",
    public readonly meta?: { field?: string; reason?: string },
  ) {
    super(kind);
    this.name = "LabDomainError";
  }
}

// Validates every cross-entity FK target on a report (+ its results) is in
// patient scope before the insert/update — a mapped 400, not a Postgres
// FK-violation 500, and the guard that one patient can't reference another's
// rows (the FK alone doesn't enforce patient scope).
async function assertReportRefsInScope(
  patientId: string,
  refs: {
    orderedBy?: string | null;
    linkedVisitId?: string | null;
  },
): Promise<void> {
  if (refs.orderedBy && !(await doctorInScope(patientId, refs.orderedBy))) {
    throw new LabDomainError("linked_entity_invalid", {
      field: "orderedBy",
      reason: "doctor_not_found",
    });
  }
  if (
    refs.linkedVisitId &&
    !(await visitInScope(patientId, refs.linkedVisitId))
  ) {
    throw new LabDomainError("linked_entity_invalid", {
      field: "linkedVisitId",
      reason: "visit_not_found",
    });
  }
}

async function assertConditionInScope(
  patientId: string,
  linkedCondition: string | null | undefined,
  field: string,
): Promise<void> {
  if (linkedCondition && !(await conditionInScope(patientId, linkedCondition))) {
    throw new LabDomainError("linked_entity_invalid", {
      field,
      reason: "condition_not_found",
    });
  }
}

export const labReportQueries = {
  // reportDate desc with createdAt tiebreaker — same-day reports render in
  // reverse write order, matching the visit timeline convention.
  async forPatient(patientId: string): Promise<LabReport[]> {
    return db
      .select()
      .from(labReports)
      .where(eq(labReports.patientId, patientId))
      .orderBy(desc(labReports.reportDate), desc(labReports.createdAt));
  },

  // Backs the §6.6 `All report types ▾` filter. reportType is free text, so the
  // filter matches on exact stored value (the page sources options from
  // distinctReportTypes()).
  async byReportType(
    patientId: string,
    reportType: string,
  ): Promise<LabReport[]> {
    return db
      .select()
      .from(labReports)
      .where(
        and(
          eq(labReports.patientId, patientId),
          eq(labReports.reportType, reportType),
        ),
      )
      .orderBy(desc(labReports.reportDate), desc(labReports.createdAt));
  },

  // Distinct non-null report types for the filter pill options.
  async distinctReportTypes(patientId: string): Promise<string[]> {
    const rows = await db
      .selectDistinct({ reportType: labReports.reportType })
      .from(labReports)
      .where(eq(labReports.patientId, patientId));
    return rows
      .map((r) => r.reportType)
      .filter((t): t is string => t !== null)
      .sort((a, b) => a.localeCompare(b));
  },

  async getById(patientId: string, id: string): Promise<LabReport | null> {
    const rows = await db
      .select()
      .from(labReports)
      .where(and(eq(labReports.id, id), eq(labReports.patientId, patientId)))
      .limit(1);
    return rows[0] ?? null;
  },

  // Resolves a `§ lab-report:<date>` citation slug. The serializer's
  // labReportSlug is the ISO report date, so the bare slug IS the date —
  // matched by construction round-trip like the other bySlug helpers, with the
  // same collision-suffix limitation (a second same-day report cites unresolved
  // for v1).
  async bySlug(patientId: string, slug: string): Promise<LabReport | null> {
    const rows = await labReportQueries.forPatient(patientId);
    return rows.find((r) => formatISODate(r.reportDate) === slug) ?? null;
  },

  // Transactional insert of a report and its marker rows. result_date is
  // denormalized from the report's reportDate (§4:401), patient_id is stamped
  // onto every result (§4:392). All FK targets are scope-checked first.
  async create(
    report: Omit<NewLabReport, "id" | "createdAt" | "updatedAt">,
    results: ReadonlyArray<NewLabResultInput>,
  ): Promise<LabReport> {
    await assertReportRefsInScope(report.patientId, {
      orderedBy: report.orderedBy,
      linkedVisitId: report.linkedVisitId,
    });
    for (const r of results) {
      await assertConditionInScope(
        report.patientId,
        r.linkedCondition,
        "results",
      );
    }

    return db.transaction(async (tx) => {
      const [row] = await tx.insert(labReports).values(report).returning();
      if (results.length > 0) {
        const resultRows: NewLabResult[] = results.map((r) => ({
          labReportId: row.id,
          patientId: report.patientId,
          marker: r.marker,
          markerNormalized: r.markerNormalized ?? null,
          value: r.value ?? null,
          valueText: r.valueText ?? null,
          unit: r.unit ?? null,
          referenceLow: r.referenceLow ?? null,
          referenceHigh: r.referenceHigh ?? null,
          flag: r.flag ?? null,
          resultDate: report.reportDate,
          linkedCondition: r.linkedCondition ?? null,
        }));
        await tx.insert(labResults).values(resultRows);
      }
      return row;
    });
  },

  async update(
    patientId: string,
    id: string,
    values: LabReportUpdate,
  ): Promise<LabReport | null> {
    await assertReportRefsInScope(patientId, {
      orderedBy: values.orderedBy,
      linkedVisitId: values.linkedVisitId,
    });
    const [row] = await db
      .update(labReports)
      .set(values)
      .where(and(eq(labReports.id, id), eq(labReports.patientId, patientId)))
      .returning();
    return row ?? null;
  },

  // lab_results.lab_report_id is onDelete:"cascade" — deleting a report removes
  // its markers with it. The report's own backlinks (linked_visit_id on the
  // report side) don't exist; visits reference labs, not the reverse.
  async delete(patientId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(labReports)
      .where(and(eq(labReports.id, id), eq(labReports.patientId, patientId)))
      .returning({ id: labReports.id });
    return result.length > 0;
  },

  // §6.7 Linked context: "Previous lipid panels · N" — same report type,
  // strictly earlier date, newest first. Returns [] when reportType is null/blank
  // (can't group an untyped report).
  //
  // Match is normalized — lowercased, trimmed, internal whitespace collapsed —
  // on BOTH sides, so trivial naming variations ("Lipid Panel" / "lipid  panel ")
  // still group. It deliberately does NOT fuzzy-match genuinely different names.
  async previousPanelsOfType(
    patientId: string,
    reportType: string | null,
    beforeDate: string,
    excludeId: string,
  ): Promise<LabReport[]> {
    const normalized = reportType?.trim().toLowerCase().replace(/\s+/g, " ");
    if (!normalized) return [];
    return db
      .select()
      .from(labReports)
      .where(
        and(
          eq(labReports.patientId, patientId),
          sql`regexp_replace(lower(btrim(${labReports.reportType})), '[[:space:]]+', ' ', 'g') = ${normalized}`,
          lt(labReports.reportDate, beforeDate),
          ne(labReports.id, excludeId),
        ),
      )
      .orderBy(desc(labReports.reportDate), desc(labReports.createdAt));
  },

  // §6.7 Linked context: conditions monitored by this report's markers
  // (lab_results.linked_condition). Distinct conditions, name-sorted.
  async monitoredConditions(
    patientId: string,
    labReportId: string,
  ): Promise<Condition[]> {
    const rows = await db
      .selectDistinct({ condition: conditions })
      .from(labResults)
      .innerJoin(conditions, eq(labResults.linkedCondition, conditions.id))
      .where(
        and(
          eq(labResults.labReportId, labReportId),
          eq(labResults.patientId, patientId),
        ),
      );
    return rows
      .map((r) => r.condition)
      .sort((a, b) => a.name.localeCompare(b.name));
  },
};

export const labResultQueries = {
  // marker asc — a stable, scannable table order for the §6.7 MARKERS section.
  async forReport(labReportId: string): Promise<LabResult[]> {
    return db
      .select()
      .from(labResults)
      .where(eq(labResults.labReportId, labReportId))
      .orderBy(asc(labResults.marker));
  },

  async forPatient(patientId: string): Promise<LabResult[]> {
    return db
      .select()
      .from(labResults)
      .where(eq(labResults.patientId, patientId))
      .orderBy(desc(labResults.resultDate), asc(labResults.marker));
  },

  // Resolves a `§ lab-result:<marker>` citation pill to its most-recent
  // measurement and parent report. Lab results have no detail page of their
  // own — the marker lives inside the §6.7 report — so the pill lands there.
  // The serializer's labResultSlug marker-part is `slugify(markerNormalized ??
  // marker)`; we match by reconstruction round-trip (the same approach the
  // report/visit/journal bySlug helpers use), taking the most recent on a tie
  // since `forPatient` is resultDate-desc ordered. The model often cites the
  // short `lab-result:creatinine` form (no date), so matching on the marker
  // alone — not marker+date — is the resilient choice.
  async byMarkerSlug(
    patientId: string,
    markerSlug: string,
  ): Promise<{ result: LabResult; report: LabReport } | null> {
    const results = await labResultQueries.forPatient(patientId);
    const match = results.find(
      (r) => slugify(r.markerNormalized ?? r.marker) === markerSlug,
    );
    if (!match?.labReportId) return null;
    const report = await labReportQueries.getById(patientId, match.labReportId);
    if (!report) return null;
    return { result: match, report };
  },

  // §6.7 `+ Log a correction` — amends a single marker in place. No
  // lab_results_changes table exists, so a correction overwrites the measured
  // fields (value / unit / range / flag); marker identity is immutable. Scoped
  // by patient_id AND the parent report so a foreign resultId can't be touched.
  async correctResult(
    patientId: string,
    labReportId: string,
    resultId: string,
    values: LabResultCorrection,
  ): Promise<LabResult | null> {
    const [row] = await db
      .update(labResults)
      .set(values)
      .where(
        and(
          eq(labResults.id, resultId),
          eq(labResults.labReportId, labReportId),
          eq(labResults.patientId, patientId),
        ),
      )
      .returning();
    return row ?? null;
  },
};
