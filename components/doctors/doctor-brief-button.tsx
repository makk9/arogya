"use client";

import { useRef, useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { displayDoctorName } from "@/lib/doctor-display";

/*
 * One-click doctor brief from the doctor page (decisions.md 2026-08-15 —
 * user-directed §5.7 deviation). POST /api/doctors/[id]/brief runs synthesis
 * headlessly and persists the brief into a titled chat session; the download
 * then goes through the same brief-pdf route the chat action uses, so both
 * paths export the identical artifact.
 *
 * Opus takes a while (~30-60s), so the flow lives in a dialog: progress →
 * download + view-in-chat, or the agent's decline message (sparse data).
 */

interface Props {
  patientId: string;
  doctorId: string;
  doctorName: string;
}

type Phase =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "ready"; sessionId: string }
  | { kind: "declined"; message: string }
  | { kind: "error"; message: string };

interface BriefResponse {
  sessionId?: string;
  declined?: boolean;
  message?: string;
  error?: { message?: string };
}

export function DoctorBriefButton({ patientId, doctorId, doctorName }: Props) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const start = async () => {
    setOpen(true);
    setPhase({ kind: "working" });
    const controller = new AbortController();
    abortRef.current = controller;

    let body: BriefResponse;
    try {
      const res = await fetch(`/api/doctors/${doctorId}/brief`, {
        method: "POST",
        signal: controller.signal,
      });
      body = (await res.json().catch(() => ({}))) as BriefResponse;
      if (controller.signal.aborted) return;
      if (!res.ok) {
        setPhase({
          kind: "error",
          message: body.error?.message ?? "Couldn't generate the brief. Try again.",
        });
        return;
      }
    } catch {
      // Cancelled by the user closing the dialog — nothing to report.
      if (controller.signal.aborted) return;
      setPhase({
        kind: "error",
        message: "Couldn't reach the server. Try again.",
      });
      return;
    }

    if (body.declined) {
      setPhase({
        kind: "declined",
        message: body.message ?? "There's not enough data for a useful brief yet.",
      });
      return;
    }
    if (body.sessionId) {
      setPhase({ kind: "ready", sessionId: body.sessionId });
      return;
    }
    setPhase({ kind: "error", message: "Couldn't generate the brief. Try again." });
  };

  const handleOpenChange = (next: boolean) => {
    // Closing mid-run cancels the request and abandons the result — a hung
    // generation must never trap the user in the dialog.
    if (!next && phase.kind === "working") abortRef.current?.abort();
    setOpen(next);
    if (!next) setPhase({ kind: "idle" });
  };

  const name = displayDoctorName(doctorName);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void start()}
      >
        Doctor brief
      </Button>

      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Doctor brief — {name}</AlertDialogTitle>
            <AlertDialogDescription>
              {phase.kind === "working"
                ? "Reading the full record and preparing the brief. This takes up to a minute."
                : phase.kind === "ready"
                  ? "The brief is ready. It's also saved as a chat, so you can review it with citations or re-download it later."
                  : phase.kind === "declined" || phase.kind === "error"
                    ? phase.message
                    : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {phase.kind === "ready" ? (
              <>
                <AlertDialogCancel>Close</AlertDialogCancel>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    window.location.assign(
                      `/patient/${patientId}/chat/${phase.sessionId}`,
                    );
                  }}
                >
                  Review in chat
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    window.location.assign(
                      `/api/chat/sessions/${phase.sessionId}/brief-pdf?index=0`,
                    );
                  }}
                >
                  Download PDF
                </Button>
              </>
            ) : phase.kind === "working" ? (
              <AlertDialogCancel>Cancel</AlertDialogCancel>
            ) : (
              <AlertDialogCancel>Close</AlertDialogCancel>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
