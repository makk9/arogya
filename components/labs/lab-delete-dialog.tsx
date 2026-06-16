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
 * Delete confirmation for a lab report. Clones visit-delete-dialog. Unlike a
 * visit (whose outcomes detach), deleting a lab report CASCADES its marker rows
 * — the copy names that, since it's a harder-to-reverse loss.
 */

interface Props {
  patientId: string;
  reportId: string;
  /** "Lipid panel · Apr 3, 2026" — identifies the report in the dialog copy. */
  reportLabel: string;
  markerCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LabDeleteDialog({
  patientId,
  reportId,
  reportLabel,
  markerCount,
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
      const res = await fetch(`/api/lab-reports/${reportId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push(`/patient/${patientId}/labs`);
        router.refresh();
        return;
      }
      const parsed = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      setError(parsed.error?.message ?? "Couldn't delete the lab report.");
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
          <AlertDialogTitle>Delete this lab report?</AlertDialogTitle>
          <AlertDialogDescription>
            {reportLabel} will be removed from the record
            {markerCount > 0
              ? `, along with its ${markerCount} ${markerCount === 1 ? "marker" : "markers"}`
              : ""}
            . This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep report</AlertDialogCancel>
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
