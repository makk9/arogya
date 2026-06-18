"use client";

import { useState, type ReactNode } from "react";

import { TypeEditProvider } from "@/components/symptoms/type-edit-context";
import type { SymptomType } from "@/db/schema";

interface Props {
  type: SymptomType;
  children: ReactNode;
}

/*
 * Client wrapper around the SymptomType detail page. Just the edit context whose
 * Edit/Done button lives in the header (no change log → no log-change provider).
 */
export function TypeDetailShell({ type, children }: Props) {
  const [editing, setEditing] = useState(false);

  return (
    <TypeEditProvider value={{ editing, setEditing, typeId: type.id }}>
      {children}
    </TypeEditProvider>
  );
}
