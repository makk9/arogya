"use client";

import { useState, type ReactNode } from "react";

import { ReportEditProvider } from "@/components/reports/report-edit-context";
import type { Report } from "@/db/schema";

interface Props {
  report: Report;
  children: ReactNode;
}

/*
 * Client wrapper around the Report detail page. Clones visit-detail-shell:
 * events have no change log, so there is no log-change provider or dialog — just
 * the edit context whose Edit/Done button lives in the header.
 */
export function ReportDetailShell({ report, children }: Props) {
  const [editing, setEditing] = useState(false);

  return (
    <ReportEditProvider value={{ editing, setEditing, reportId: report.id }}>
      {children}
    </ReportEditProvider>
  );
}
