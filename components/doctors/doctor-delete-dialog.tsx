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
import { displayDoctorName } from "@/lib/doctor-display";

/*
 * Delete confirmation for the `…` menu. DELETE /api/doctors/[id] → on 204
 * redirect to the doctors list. Medications, conditions, allergies, labs, and
 * reports that reference this doctor keep their rows and null the reference
 * (onDelete:"set null"); visits are the exception — visits.doctor_id is
 * restrict, so the server refuses with 409 delete_blocked and the message
 * renders in the banner. (Unreachable until the Visit vertical ships a create
 * path, but the handling is in place.)
 */

interface Props {
  patientId: string;
  doctorId: string;
  doctorName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export function DoctorDeleteDialog({
  patientId,
  doctorId,
  doctorName,
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
      res = await fetch(`/api/doctors/${doctorId}`, { method: "DELETE" });
    } catch {
      setBannerError("Couldn't reach the server. Try again.");
      setPending(false);
      return;
    }

    if (res.status === 204) {
      router.push(`/patient/${patientId}/doctors`);
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
          <AlertDialogTitle>
            Delete {displayDoctorName(doctorName)}
          </AlertDialogTitle>
          <AlertDialogDescription>
            This removes the doctor from the record. Medications and conditions
            they&apos;re linked to stay, but lose the reference. This can&apos;t
            be undone.
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
