"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { todayLocal } from "@/lib/datetime";
import { displayDoctorName } from "@/lib/doctor-display";
import {
  doctorChangeFormSchema,
  type DoctorChangeFormValues,
} from "@/lib/schemas/forms/doctor";

/*
 * `+ Log a change` dialog per design.md 6.5:1383. Writes a row to
 * doctor_changes via POST /api/doctors/[id]/changes and updates the paired
 * field on the parent doctor in the same transaction.
 *
 * Clones condition-log-change-dialog.tsx, trimmed for the Doctor model: two
 * change fields (specialty / clinic — decisions.md 2026-06-09), both free-text
 * Inputs rather than Selects, and NO stale-status branch — Doctor has no
 * status machine, so the server has no 409 path here.
 *
 * The newValue placeholder swaps with the selected field so the input
 * telegraphs what's expected.
 */

const FIELD_LABEL_CLASS =
  "font-mono text-xs uppercase tracking-wide text-foreground";

interface Props {
  doctorId: string;
  doctorName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: {
      fieldErrors?: Record<string, string[]>;
      formErrors?: string[];
    };
  };
}

const FIELD_OPTIONS = [
  { value: "specialty" as const, label: "Specialty" },
  { value: "clinic" as const, label: "Clinic" },
];

const VALUE_PLACEHOLDER: Record<DoctorChangeFormValues["field"], string> = {
  specialty: "e.g. Interventional cardiology",
  clinic: "e.g. Manipal MG Road",
};

export function DoctorLogChangeDialog({
  doctorId,
  doctorName,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [bannerError, setBannerError] = useState<string | null>(null);

  const defaultValues: DoctorChangeFormValues = {
    field: "specialty",
    newValue: "",
    reason: "",
    // Browser-local "today" — user-tz form defaults per decisions.md 2026-06-10.
    changedAt: todayLocal(),
  };

  const {
    register,
    control,
    handleSubmit,
    setValue,
    clearErrors,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<DoctorChangeFormValues>({
    resolver: zodResolver(doctorChangeFormSchema),
    defaultValues,
    mode: "onSubmit",
  });

  // Local mirror of the field selector so we don't call RHF's `watch`
  // (react-compiler flags it as not memoizable).
  const [activeField, setActiveField] =
    useState<DoctorChangeFormValues["field"]>("specialty");

  const closeAndReset = () => {
    onOpenChange(false);
    reset(defaultValues);
    setActiveField("specialty");
    setBannerError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) closeAndReset();
    else onOpenChange(true);
  };

  const formKeys: ReadonlyArray<keyof DoctorChangeFormValues> = [
    "field",
    "newValue",
    "reason",
    "changedAt",
  ];

  const onSubmit = handleSubmit(async (values) => {
    setBannerError(null);

    const body = {
      field: values.field,
      newValue: values.newValue,
      reason: values.reason?.trim() || undefined,
      changedAt: values.changedAt?.trim() || undefined,
    };

    let res: Response;
    try {
      res = await fetch(`/api/doctors/${doctorId}/changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      setBannerError("Couldn't reach the server. Try again.");
      return;
    }

    if (res.ok) {
      closeAndReset();
      router.refresh();
      return;
    }

    const parsed = (await res.json().catch(() => ({}))) as ApiErrorBody;
    const errBody = parsed.error;

    if (errBody?.code === "validation_failed" && errBody.details) {
      const unknown: string[] = [];
      for (const [k, msgs] of Object.entries(
        errBody.details.fieldErrors ?? {},
      )) {
        if (!msgs[0]) continue;
        if ((formKeys as ReadonlyArray<string>).includes(k)) {
          setError(k as keyof DoctorChangeFormValues, { message: msgs[0] });
        } else {
          unknown.push(`${k}: ${msgs[0]}`);
        }
      }
      const formErrs = errBody.details.formErrors ?? [];
      const banner = [...formErrs, ...unknown];
      if (banner.length) setBannerError(banner.join("; "));
      return;
    }

    setBannerError(errBody?.message ?? "Something went wrong. Try again.");
  });

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Log a change for {displayDoctorName(doctorName)}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Records a change in this doctor&apos;s history — a clinic move or a
            specialty correction.
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

        <form
          id="doctor-log-change-form"
          noValidate
          onSubmit={onSubmit}
          className="flex flex-col gap-4"
        >
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="field">
              What changed
            </FieldLabel>
            <Controller
              control={control}
              name="field"
              render={({ field }) => (
                <Select
                  value={field.value}
                  items={FIELD_OPTIONS}
                  onValueChange={(next) => {
                    if (!next) return;
                    const nextField = next as DoctorChangeFormValues["field"];
                    field.onChange(nextField);
                    setActiveField(nextField);
                    setValue("newValue", "");
                    clearErrors("newValue");
                  }}
                >
                  <SelectTrigger id="field" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError
              errors={errors.field ? [{ message: errors.field.message }] : []}
            />
          </Field>

          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="newValue">
              New value
            </FieldLabel>
            <Input
              id="newValue"
              autoComplete="off"
              placeholder={VALUE_PLACEHOLDER[activeField]}
              aria-invalid={!!errors.newValue}
              {...register("newValue")}
            />
            <FieldError
              errors={
                errors.newValue ? [{ message: errors.newValue.message }] : []
              }
            />
          </Field>

          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="reason">
              Reason
            </FieldLabel>
            <Textarea
              id="reason"
              rows={2}
              placeholder="e.g. moved practice to Manipal in May"
              aria-invalid={!!errors.reason}
              {...register("reason")}
            />
            <FieldError
              errors={errors.reason ? [{ message: errors.reason.message }] : []}
            />
          </Field>

          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="changedAt">
              Changed on
            </FieldLabel>
            <Input
              id="changedAt"
              type="date"
              aria-invalid={!!errors.changedAt}
              {...register("changedAt")}
            />
            <FieldError
              errors={
                errors.changedAt ? [{ message: errors.changedAt.message }] : []
              }
            />
          </Field>
        </form>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            type="submit"
            form="doctor-log-change-form"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving…" : "Save"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
