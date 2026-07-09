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
 * Delete confirmation for the `…` menu. DELETE /api/medications/[id] → on 204
 * redirect to the medications list. Deletion removes the medication and its
 * change log (medication_changes is onDelete:"cascade"). Insights that cite the
 * medication reference it polymorphically via jsonb, not an FK, so they are not
 * blocked or cascaded — a stale citation simply won't resolve.
 *
 * No reason field — unlike Discontinue (a logged state change that keeps the
 * record), Delete removes the record outright (§6.5 `…` menu destructive action).
 */

interface Props {
  patientId: string;
  medicationId: string;
  medicationName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export function MedicationDeleteDialog({
  patientId,
  medicationId,
  medicationName,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (pending) return;
    if (!next) setBannerError(null);
    onOpenChange(next);
  };

  const onConfirm = async () => {
    setBannerError(null);
    setPending(true);

    let res: Response;
    try {
      res = await fetch(`/api/medications/${medicationId}`, {
        method: "DELETE",
      });
    } catch {
      setBannerError("Couldn't reach the server. Try again.");
      setPending(false);
      return;
    }

    if (res.status === 204) {
      router.push(`/patient/${patientId}/medications`);
      router.refresh();
      return;
    }

    const parsed = (await res.json().catch(() => ({}))) as ApiErrorBody;
    setBannerError(parsed.error?.message ?? "Couldn't delete. Try again.");
    setPending(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {medicationName}</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the medication and its full change history from the
            record. This can&apos;t be undone. To stop a current medication
            while keeping its history, use Discontinue instead.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {bannerError ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {bannerError}
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={() => void onConfirm()}
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
