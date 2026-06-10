"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  SEVERITY_OPTIONS,
  STATUS_OPTIONS,
} from "@/components/conditions/condition-options";
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
import type { Condition } from "@/db/schema";
import {
  conditionChangeFormSchema,
  type ConditionChangeFormValues,
} from "@/lib/schemas/forms/condition";

/*
 * `+ Log a change` dialog per design.md 6.5:1383. Writes a row to
 * condition_changes via POST /api/conditions/[id]/changes and updates the paired
 * field on the parent condition in the same transaction.
 *
 * Clones medication-log-change-dialog.tsx, trimmed for the Condition model:
 *  - three change fields (status / severity / managing_doctor), no dose/frequency
 *  - NO linkedVisitId (condition_changes has no such column)
 *  - status is a multi-option select (all 5, minus the current) — not the single
 *    forced `paused` Medication uses
 *  - managing-doctor select excludes the current managing doctor and handles an
 *    empty doctor list
 *
 * A status no-op (newValue === current.status) is rejected server-side with 409
 * invalid_state_transition; we surface that as an "already set" branch. The
 * managing-doctor no_op / doctor_not_found cases come back as validation_failed
 * with a per-field message on newValue.
 *
 * Every Select passes `items` so Base UI's <SelectValue> renders the option
 * label on the trigger (not the raw value).
 */

const FIELD_LABEL_CLASS =
  "font-mono text-xs uppercase tracking-wide text-foreground";

export interface DoctorOption {
  id: string;
  name: string;
  specialty: string;
}

interface Props {
  conditionId: string;
  conditionName: string;
  doctors: ReadonlyArray<DoctorOption>;
  currentStatus: Condition["status"];
  currentManagingDoctorId: string | null;
  todayInPatientTz: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DialogState =
  | { kind: "normal" }
  | { kind: "stale-status"; currentStatus: string };

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: {
      fieldErrors?: Record<string, string[]>;
      formErrors?: string[];
      currentStatus?: string;
    };
  };
}

const FIELD_OPTIONS = [
  { value: "status" as const, label: "Status" },
  { value: "severity" as const, label: "Severity" },
  { value: "managing_doctor" as const, label: "Managing doctor" },
];

export function ConditionLogChangeDialog({
  conditionId,
  conditionName,
  doctors,
  currentStatus,
  currentManagingDoctorId,
  todayInPatientTz,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [state, setState] = useState<DialogState>({ kind: "normal" });

  const availableStatuses = STATUS_OPTIONS.filter(
    (o) => o.value !== currentStatus,
  );
  const availableDoctors = doctors.filter(
    (d) => d.id !== currentManagingDoctorId,
  );
  const firstStatus = availableStatuses[0]?.value ?? "";

  const defaultValues: ConditionChangeFormValues = {
    field: "status",
    newValue: firstStatus,
    reason: "",
    changedAt: todayInPatientTz,
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
  } = useForm<ConditionChangeFormValues>({
    resolver: zodResolver(conditionChangeFormSchema),
    defaultValues,
    mode: "onSubmit",
  });

  // Local mirror of the field selector so we don't call RHF's `watch`
  // (react-compiler flags it as not memoizable).
  const [activeField, setActiveField] =
    useState<ConditionChangeFormValues["field"]>("status");

  const closeAndReset = () => {
    onOpenChange(false);
    reset(defaultValues);
    setActiveField("status");
    setBannerError(null);
    setState({ kind: "normal" });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) closeAndReset();
    else onOpenChange(true);
  };

  const handleOkAfterStale = () => {
    closeAndReset();
    router.refresh();
  };

  const formKeys: ReadonlyArray<keyof ConditionChangeFormValues> = [
    "field",
    "newValue",
    "reason",
    "changedAt",
  ];

  // Default newValue for a freshly-selected field.
  const defaultFor = (field: ConditionChangeFormValues["field"]): string => {
    if (field === "status") return firstStatus;
    if (field === "severity") return SEVERITY_OPTIONS[0]?.value ?? "";
    return ""; // managing_doctor — force an explicit pick
  };

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
      res = await fetch(`/api/conditions/${conditionId}/changes`, {
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

    if (errBody?.code === "invalid_state_transition") {
      setState({
        kind: "stale-status",
        currentStatus: errBody.details?.currentStatus ?? "unknown",
      });
      return;
    }

    if (errBody?.code === "validation_failed" && errBody.details) {
      const unknown: string[] = [];
      for (const [k, msgs] of Object.entries(
        errBody.details.fieldErrors ?? {},
      )) {
        if (!msgs[0]) continue;
        if ((formKeys as ReadonlyArray<string>).includes(k)) {
          setError(k as keyof ConditionChangeFormValues, { message: msgs[0] });
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
            {state.kind === "stale-status"
              ? "Status changed elsewhere"
              : `Log a change for ${conditionName}`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {state.kind === "stale-status"
              ? `Current status is "${state.currentStatus}". Refresh to see the latest state.`
              : `Records a change in this condition's history.`}
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

            <form
              id="condition-log-change-form"
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
                        const nextField =
                          next as ConditionChangeFormValues["field"];
                        field.onChange(nextField);
                        setActiveField(nextField);
                        setValue("newValue", defaultFor(nextField));
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
                  errors={
                    errors.field ? [{ message: errors.field.message }] : []
                  }
                />
              </Field>

              <Field>
                <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="newValue">
                  New value
                </FieldLabel>
                {activeField === "status" ? (
                  <Controller
                    control={control}
                    name="newValue"
                    render={({ field }) => (
                      <Select
                        value={field.value || undefined}
                        items={availableStatuses}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id="newValue" className="w-full">
                          <SelectValue placeholder="Select status…" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableStatuses.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                ) : activeField === "severity" ? (
                  <Controller
                    control={control}
                    name="newValue"
                    render={({ field }) => (
                      <Select
                        value={field.value || undefined}
                        items={SEVERITY_OPTIONS}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id="newValue" className="w-full">
                          <SelectValue placeholder="Select severity…" />
                        </SelectTrigger>
                        <SelectContent>
                          {SEVERITY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                ) : (
                  <Controller
                    control={control}
                    name="newValue"
                    render={({ field }) => (
                      <Select
                        value={field.value || undefined}
                        items={availableDoctors.map((d) => ({
                          value: d.id,
                          label: `Dr ${d.name} · ${d.specialty}`,
                        }))}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id="newValue" className="w-full">
                          <SelectValue placeholder="Select doctor…" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableDoctors.length === 0 ? (
                            <SelectItem value="__none" disabled>
                              No other doctors on file
                            </SelectItem>
                          ) : (
                            availableDoctors.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                Dr {d.name} · {d.specialty}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
                <FieldError
                  errors={
                    errors.newValue
                      ? [{ message: errors.newValue.message }]
                      : []
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
                  placeholder="e.g. brought under control after dose increase"
                  aria-invalid={!!errors.reason}
                  {...register("reason")}
                />
                <FieldError
                  errors={
                    errors.reason ? [{ message: errors.reason.message }] : []
                  }
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
                    errors.changedAt
                      ? [{ message: errors.changedAt.message }]
                      : []
                  }
                />
              </Field>
            </form>
          </>
        ) : null}

        <AlertDialogFooter>
          {state.kind === "normal" ? (
            <>
              <AlertDialogCancel disabled={isSubmitting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                type="submit"
                form="condition-log-change-form"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving…" : "Save"}
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogAction onClick={handleOkAfterStale}>
              OK
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
