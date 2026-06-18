"use client";

import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { EpisodeDeleteDialog } from "@/components/symptoms/episode-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  patientId: string;
  episodeId: string;
  episodeLabel: string;
}

/*
 * `…` menu per §6.7:1530. Single action: Delete (FK-safe — an episode's
 * linked_visit_id is the other direction; deleting it touches nothing else).
 * Export source deferred with the extraction pipeline (Phase E).
 */
export function EpisodeActionsMenu({ patientId, episodeId, episodeLabel }: Props) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Episode actions"
            >
              <MoreHorizontal />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EpisodeDeleteDialog
        patientId={patientId}
        episodeId={episodeId}
        episodeLabel={episodeLabel}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
