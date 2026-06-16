"use client";

import { useState, type ReactNode } from "react";

import { VisitEditProvider } from "@/components/visits/visit-edit-context";
import type { Visit } from "@/db/schema";

interface Props {
  visit: Visit;
  children: ReactNode;
}

/*
 * Client wrapper around the Visit detail page. Half of the state-entity shell
 * (condition/allergy-detail-shell): events have no change log, so there is no
 * log-change provider or dialog — just the edit context whose Edit/Done button
 * lives in the header.
 */
export function VisitDetailShell({ visit, children }: Props) {
  const [editing, setEditing] = useState(false);

  return (
    <VisitEditProvider value={{ editing, setEditing, visitId: visit.id }}>
      {children}
    </VisitEditProvider>
  );
}
