"use client";

import { useState, type ReactNode } from "react";

import { EpisodeEditProvider } from "@/components/symptoms/episode-edit-context";
import type { SymptomEpisode } from "@/db/schema";

interface Props {
  episode: SymptomEpisode;
  children: ReactNode;
}

/*
 * Client wrapper around the SymptomEpisode detail page. Half of the state-entity
 * shell (events have no change log, so no log-change provider) — just the edit
 * context whose Edit/Done button lives in the header. Clones visit-detail-shell.
 */
export function EpisodeDetailShell({ episode, children }: Props) {
  const [editing, setEditing] = useState(false);

  return (
    <EpisodeEditProvider value={{ editing, setEditing, episodeId: episode.id }}>
      {children}
    </EpisodeEditProvider>
  );
}
