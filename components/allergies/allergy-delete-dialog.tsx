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
 * Delete confirmation for the `…` menu. DELETE /api/allergies/[id] → on 204
 * redirect to the allergies list. Trivially FK-safe: only allergy_changes
 * references allergies, and it cascades.
 */

interface Props {
  patientId: string;
  allergyId: string;
  substance: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export function AllergyDeleteDialog({
  patientId,
  allergyId,
  substance,
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
      res = await fetch(`/api/allergies/${allergyId}`, { method: "DELETE" });
    } catch {
      setBannerError("Couldn't reach the server. Try again.");
      setPending(false);
      return;
    }

    if (res.status === 204) {
      router.push(`/patient/${patientId}/allergies`);
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
          <AlertDialogTitle>Delete {substance}</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the allergy and its change history from the record.
            This can&apos;t be undone.
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
