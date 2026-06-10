"use client";

import { createContext, useContext, type ReactNode } from "react";

interface DoctorEditValue {
  editing: boolean;
  setEditing: (next: boolean) => void;
  doctorId: string;
}

const DoctorEditContext = createContext<DoctorEditValue | null>(null);

export function DoctorEditProvider({
  value,
  children,
}: {
  value: DoctorEditValue;
  children: ReactNode;
}) {
  return (
    <DoctorEditContext.Provider value={value}>
      {children}
    </DoctorEditContext.Provider>
  );
}

export function useDoctorEdit(): DoctorEditValue {
  const ctx = useContext(DoctorEditContext);
  if (!ctx) {
    throw new Error("useDoctorEdit must be used inside <DoctorEditProvider>");
  }
  return ctx;
}

// Optional read — InlineField needs this when used outside a provider. Returns
// null instead of throwing so callers can branch.
export function useMaybeDoctorEdit(): DoctorEditValue | null {
  return useContext(DoctorEditContext);
}
