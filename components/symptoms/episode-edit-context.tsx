"use client";

import { createContext, useContext, type ReactNode } from "react";

/*
 * Edit-mode context for the SymptomEpisode detail page. Clones
 * visit-edit-context: the Edit/Done toggle lives in the header; inline fields
 * across the sections subscribe here. Episodes have no change log, so this is
 * the only edit surface (§6.7 — Edit corrects the event in place).
 */

interface EpisodeEditContextValue {
  editing: boolean;
  setEditing: (next: boolean) => void;
  episodeId: string;
}

const EpisodeEditContext = createContext<EpisodeEditContextValue | null>(null);

export function EpisodeEditProvider({
  value,
  children,
}: {
  value: EpisodeEditContextValue;
  children: ReactNode;
}) {
  return (
    <EpisodeEditContext.Provider value={value}>
      {children}
    </EpisodeEditContext.Provider>
  );
}

export function useEpisodeEdit(): EpisodeEditContextValue {
  const ctx = useContext(EpisodeEditContext);
  if (!ctx) {
    throw new Error("useEpisodeEdit must be used within EpisodeEditProvider");
  }
  return ctx;
}

/** Null-safe variant for components that render outside the provider. */
export function useMaybeEpisodeEdit(): EpisodeEditContextValue | null {
  return useContext(EpisodeEditContext);
}
