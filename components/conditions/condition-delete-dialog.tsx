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
 * Delete confirmation for the `…` menu. DELETE /api/conditions/[id] → on 204
 * redirect to the conditions list. Deletion is FK-safe: medications.purpose and
 * lab_results.linked_condition are onDelete:"set null", so any linked row simply
 * loses its reference (it does not block, and is not cascade-deleted).
 *
 * No reason field — unlike Medication's Discontinue (a logged state change),
 * Delete removes the record outright (§6.5 `…` menu destructive action).
 */

interface Props {
  patientId: string;
  conditionId: string;
  conditionName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export function ConditionDeleteDialog({
  patientId,
  conditionId,
  conditionName,
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
      res = await fetch(`/api/conditions/${conditionId}`, { method: "DELETE" });
    } catch {
      setBannerError("Couldn't reach the server. Try again.");
      setPending(false);
      return;
    }

    if (res.status === 204) {
      router.push(`/patient/${patientId}/conditions`);
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
          <AlertDialogTitle>Delete {conditionName}</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the condition from the record. Linked medications and
            labs stay, but lose their link to it. This can&apos;t be undone.
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
