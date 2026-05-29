"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { discontinueMedicationSchema } from "@/lib/schemas/api/medication";

/*
 * 409 invalid_state_transition swaps the form CTA for an OK that calls
 * router.refresh(): the page is stale, refreshing is the only way out
 * cleanly. Reason constraint derives from the API schema (so the contract
 * stays single-sourced); only the friendlier required-message lives here.
 */

const formSchema = z.object({
  reason: discontinueMedicationSchema.shape.reason
    .min(1, "Tell us briefly why — this lands in the change log."),
});
type FormValues = z.infer<typeof formSchema>;

// Discriminated dialog state. "normal" is the entry-the-reason mode;
// "stale" means the API rejected with 409 and the page needs a refresh.
// `at` is the API-supplied discontinuedOn when available, null when the
// route's `details` didn't carry it (shouldn't happen in practice, but
// the API contract types it as optional).
type DialogState =
  | { kind: "normal" }
  | { kind: "stale"; at: string | null };

interface Props {
  medicationId: string;
  medicationName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DiscontinueErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: {
      fieldErrors?: Record<string, string[]>;
      formErrors?: string[];
      currentStatus?: string;
      discontinuedOn?: string | null;
    };
  };
}

export function MedicationDiscontinueDialog({
  medicationId,
  medicationName,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [state, setState] = useState<DialogState>({ kind: "normal" });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { reason: "" },
    mode: "onSubmit",
  });

  const closeAndReset = () => {
    onOpenChange(false);
    reset({ reason: "" });
    setBannerError(null);
    setState({ kind: "normal" });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      closeAndReset();
    } else {
      onOpenChange(true);
    }
  };

  const handleOkAfterStale = () => {
    closeAndReset();
    router.refresh();
  };

  const onSubmit = handleSubmit(async (values) => {
    setBannerError(null);

    let res: Response;
    try {
      res = await fetch(
        `/api/medications/${medicationId}/discontinue`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: values.reason }),
        },
      );
    } catch {
      setBannerError("Couldn't reach the server. Try again.");
      return;
    }

    if (res.ok) {
      closeAndReset();
      router.refresh();
      return;
    }

    const parsed = (await res.json().catch(() => ({}))) as DiscontinueErrorBody;
    const errBody = parsed.error;

    if (errBody?.code === "invalid_state_transition") {
      setState({ kind: "stale", at: errBody.details?.discontinuedOn ?? null });
      return;
    }

    if (
      errBody?.code === "validation_failed" &&
      errBody.details?.fieldErrors?.reason?.[0]
    ) {
      setError("reason", {
        message: errBody.details.fieldErrors.reason[0],
      });
      return;
    }

    setBannerError(errBody?.message ?? "Something went wrong. Try again.");
  });

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {state.kind === "stale"
              ? "Already discontinued"
              : `Mark ${medicationName} discontinued`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {state.kind === "stale"
              ? state.at
                ? `This medication was discontinued on ${state.at}.`
                : `This medication is already discontinued.`
              : `Records a status change in this medication's history.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {state.kind === "normal" ? (
          <>
            {bannerError ? (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {bannerError}
              </div>
            ) : null}
            <form id="discontinue-form" noValidate onSubmit={onSubmit}>
              <Field>
                <FieldLabel
                  htmlFor="reason"
                  className="font-mono text-xs uppercase tracking-wide"
                >
                  Reason
                </FieldLabel>
                <Input
                  id="reason"
                  placeholder="e.g. side effects too strong"
                  autoComplete="off"
                  aria-invalid={!!errors.reason}
                  disabled={isSubmitting}
                  {...register("reason")}
                />
                <FieldError
                  errors={
                    errors.reason ? [{ message: errors.reason.message }] : []
                  }
                />
              </Field>
            </form>
          </>
        ) : null}

        <AlertDialogFooter>
          {state.kind === "stale" ? (
            <AlertDialogAction onClick={handleOkAfterStale}>OK</AlertDialogAction>
          ) : (
            <>
              <AlertDialogCancel disabled={isSubmitting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                type="submit"
                form="discontinue-form"
                variant="destructive"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Discontinuing…" : "Discontinue"}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
