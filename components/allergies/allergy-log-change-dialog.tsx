"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  SEVERITY_OPTIONS,
  STATUS_OPTIONS,
} from "@/components/allergies/allergy-options";
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
import type { Allergy } from "@/db/schema";
import { todayLocal } from "@/lib/datetime";
import {
  allergyChangeFormSchema,
  type AllergyChangeFormValues,
} from "@/lib/schemas/forms/allergy";

/*
 * `+ Log a change` dialog per design.md 6.5:1383. Writes a row to
 * allergy_changes via POST /api/allergies/[id]/changes and updates the paired
 * field on the parent allergy in the same transaction.
 *
 * Clones condition-log-change-dialog.tsx, trimmed for the Allergy model:
 * two change fields only (status / severity — the §6.5:1402 History axes),
 * no doctor select, no linkedVisitId. The status select excludes the current
 * status (a no-op would 409 server-side anyway; we surface a stale-status
 * branch if a parallel write got there first).
 */

const FIELD_LABEL_CLASS =
  "font-mono text-xs uppercase tracking-wide text-foreground";

interface Props {
  allergyId: string;
  substance: string;
  currentStatus: Allergy["status"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Preselects the changed field when opened from a value card in the Current
   * section. The shell keys this dialog per open, so mount-time defaults are
   * enough — no reset effect needed.
   */
  initialField?: AllergyChangeFormValues["field"] | null;
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
];

export function AllergyLogChangeDialog({
  allergyId,
  substance,
  currentStatus,
  open,
  onOpenChange,
  initialField,
}: Props) {
  const router = useRouter();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [state, setState] = useState<DialogState>({ kind: "normal" });

  const availableStatuses = STATUS_OPTIONS.filter(
    (o) => o.value !== currentStatus,
  );
  const firstStatus = availableStatuses[0]?.value ?? "";

  const startField: AllergyChangeFormValues["field"] = initialField ?? "status";

  // Default newValue for a freshly-selected field.
  const defaultFor = (field: AllergyChangeFormValues["field"]): string => {
    if (field === "status") return firstStatus;
    return SEVERITY_OPTIONS[0]?.value ?? "";
  };

  const defaultValues: AllergyChangeFormValues = {
    field: startField,
    newValue: defaultFor(startField),
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
  } = useForm<AllergyChangeFormValues>({
    resolver: zodResolver(allergyChangeFormSchema),
    defaultValues,
    mode: "onSubmit",
  });

  // Local mirror of the field selector so we don't call RHF's `watch`
  // (react-compiler flags it as not memoizable).
  const [activeField, setActiveField] =
    useState<AllergyChangeFormValues["field"]>(startField);

  const closeAndReset = () => {
    onOpenChange(false);
    reset(defaultValues);
    setActiveField(startField);
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

  const formKeys: ReadonlyArray<keyof AllergyChangeFormValues> = [
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
      res = await fetch(`/api/allergies/${allergyId}/changes`, {
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
          setError(k as keyof AllergyChangeFormValues, { message: msgs[0] });
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
              : `Log a change for ${substance}`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {state.kind === "stale-status"
              ? `Current status is "${state.currentStatus}". Refresh to see the latest state.`
              : `Records a change in this allergy's history.`}
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
              id="allergy-log-change-form"
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
                          next as AllergyChangeFormValues["field"];
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
                        value={field.value || null}
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
                ) : (
                  <Controller
                    control={control}
                    name="newValue"
                    render={({ field }) => (
                      <Select
                        value={field.value || null}
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
                  placeholder="e.g. reaction recurred after re-exposure"
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
                form="allergy-log-change-form"
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
