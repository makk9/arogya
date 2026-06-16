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
 * Delete confirmation for a visit. Clones allergy-delete-dialog. The copy
 * names the detach behavior when outcomes exist: linked med changes / labs /
 * reports keep their rows (linked_visit_id is onDelete:"set null") but lose
 * the link back to this visit.
 */

interface Props {
  patientId: string;
  visitId: string;
  /** "Dr Desai · Apr 3, 2026" — identifies the visit in the dialog copy. */
  visitLabel: string;
  outcomeCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VisitDeleteDialog({
  patientId,
  visitId,
  visitLabel,
  outcomeCount,
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
      const res = await fetch(`/api/visits/${visitId}`, { method: "DELETE" });
      if (res.ok) {
        router.push(`/patient/${patientId}/visits`);
        router.refresh();
        return;
      }
      const parsed = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      setError(parsed.error?.message ?? "Couldn't delete the visit.");
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
          <AlertDialogTitle>Delete this visit?</AlertDialogTitle>
          <AlertDialogDescription>
            The visit on {visitLabel} will be removed from the record.
            {outcomeCount > 0
              ? ` ${outcomeCount} linked ${outcomeCount === 1 ? "outcome" : "outcomes"} (medication changes, labs, reports) will stay in the record but lose their link to this visit.`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep visit</AlertDialogCancel>
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
