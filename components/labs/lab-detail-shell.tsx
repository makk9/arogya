"use client";

import { useState, type ReactNode } from "react";

import { LabEditProvider } from "@/components/labs/lab-edit-context";
import type { LabReport } from "@/db/schema";

interface Props {
  report: LabReport;
  children: ReactNode;
}

/*
 * Client wrapper around the Lab detail page. Like the Visit shell, events have
 * no change log, so there is no log-change provider — just the edit context
 * whose Edit/Done button lives in the header. Scopes the report-level edit
 * surface only; the MARKERS correction dialog owns its own state.
 */
export function LabDetailShell({ report, children }: Props) {
  const [editing, setEditing] = useState(false);

  return (
    <LabEditProvider value={{ editing, setEditing, reportId: report.id }}>
      {children}
    </LabEditProvider>
  );
}
