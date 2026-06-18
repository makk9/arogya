"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/*
 * Delete confirmation for a symptom episode. Clones visit-delete-dialog. After
 * delete, returns to the symptoms timeline — unlike the type delete (which is
 * cascade-destructive), removing one episode leaves the type and its other
 * episodes intact.
 */

interface Props {
  patientId: string;
  episodeId: string;
  /** "Dizziness · Apr 28, 2026" — identifies the episode in the dialog copy. */
  episodeLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EpisodeDeleteDialog({
  patientId,
  episodeId,
  episodeLabel,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/symptom-episodes/${episodeId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push(`/patient/${patientId}/symptoms`);
        router.refresh();
        return;
      }
      const parsed = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      setError(parsed.error?.message ?? "Couldn't delete the episode.");
      setPending(false);
    } catch {
      setError("Couldn't reach the server.");
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this episode?</AlertDialogTitle>
          <AlertDialogDescription>
            The {episodeLabel} episode will be removed from the record. The
            symptom and its other episodes stay.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep episode</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={() => void handleDelete()}
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
