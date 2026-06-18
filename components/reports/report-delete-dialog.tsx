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
 * Delete confirmation for a report. Clones visit-delete-dialog. The copy names
 * the detach behavior when outcomes exist: derived medications / conditions keep
 * their rows (source_report_id is onDelete:"set null") but lose the link back to
 * this report.
 */

interface Props {
  patientId: string;
  reportId: string;
  /** The report title — identifies it in the dialog copy. */
  reportLabel: string;
  outcomeCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportDeleteDialog({
  patientId,
  reportId,
  reportLabel,
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
      const res = await fetch(`/api/reports/${reportId}`, { method: "DELETE" });
      if (res.ok) {
        router.push(`/patient/${patientId}/reports`);
        router.refresh();
        return;
      }
      const parsed = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      setError(parsed.error?.message ?? "Couldn't delete the report.");
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
          <AlertDialogTitle>Delete this report?</AlertDialogTitle>
          <AlertDialogDescription>
            “{reportLabel}” will be removed from the record.
            {outcomeCount > 0
              ? ` ${outcomeCount} linked ${outcomeCount === 1 ? "entry" : "entries"} (medications, conditions) will stay in the record but lose their link to this report.`
              : ""}
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
