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
 * Delete confirmation for a SymptomType. Unlike the episode delete, this is
 * cascade-destructive: symptom_episodes.symptom_type_id is onDelete:"cascade",
 * so deleting the type removes its whole episode stream. The copy warns with the
 * episode count (a single-confirmation destructive pattern, CLAUDE.md).
 */

interface Props {
  patientId: string;
  typeId: string;
  typeName: string;
  episodeCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TypeDeleteDialog({
  patientId,
  typeId,
  typeName,
  episodeCount,
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
      const res = await fetch(`/api/symptom-types/${typeId}`, {
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
      setError(parsed.error?.message ?? "Couldn't delete the symptom.");
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
          <AlertDialogTitle>Delete {typeName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the symptom and{" "}
            {episodeCount > 0
              ? `all ${episodeCount} ${episodeCount === 1 ? "episode" : "episodes"} logged under it`
              : "its episode history"}
            . This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep symptom</AlertDialogCancel>
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
