"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  enumOptionsFor,
  TREND_FIELD_OPTIONS,
  trendValueLabel,
  type LifestyleTrendFieldKey,
} from "@/components/lifestyle/lifestyle-options";
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
import type { LifestyleProfile } from "@/db/schema";
import { todayLocal } from "@/lib/datetime";
import {
  lifestyleChangeFormSchema,
  type LifestyleChangeFormValues,
} from "@/lib/schemas/forms/lifestyle";

/*
 * `+ Log a change` dialog per design.md 6.5:1383 — the write path for the
 * §4:538 trend story. Writes a row to lifestyle_changes via
 * POST /api/lifestyle/changes and updates the profile field in the same
 * transaction (lazily creating the profile row if needed).
 *
 * Clones allergy-log-change-dialog.tsx with the seven-field selector:
 *  - the three narrative patterns take a textarea PREFILLED with the current
 *    value (trend changes are usually edits of the prior narrative — "…
 *    Recently cut sugar." appends to the existing diet pattern)
 *  - the four enums take a select excluding the current value (a no-op would
 *    409 server-side anyway; a stale-value branch covers parallel writes)
 */

const FIELD_LABEL_CLASS =
  "font-mono text-xs uppercase tracking-wide text-foreground";

interface Props {
  /** Null when the profile row doesn't exist yet. */
  profile: LifestyleProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Preselects the changed field when opened from a specific value box in the
   * Current section. The shell keys this dialog per open, so mount-time
   * defaults are enough — no reset effect needed.
   */
  initialField?: LifestyleTrendFieldKey | null;
}

type DialogState =
  | { kind: "normal" }
  | { kind: "stale-value"; field: string; currentValue: string };

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: {
      fieldErrors?: Record<string, string[]>;
      formErrors?: string[];
      field?: string;
      currentValue?: string | null;
    };
  };
}

export function LifestyleLogChangeDialog({
  profile,
  open,
  onOpenChange,
  initialField,
}: Props) {
  const router = useRouter();
  const startField: LifestyleTrendFieldKey = initialField ?? "dietPattern";
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [state, setState] = useState<DialogState>({ kind: "normal" });

  const currentValueOf = (field: LifestyleTrendFieldKey): string | null =>
    profile?.[field] ?? null;

  // Default newValue for a freshly-selected field: patterns prefill with the
  // current narrative; enums pick the first non-current option.
  const defaultFor = (field: LifestyleTrendFieldKey): string => {
    const options = enumOptionsFor(field);
    if (!options) return currentValueOf(field) ?? "";
    const current = currentValueOf(field);
    return options.find((o) => o.value !== current)?.value ?? "";
  };

  const defaultValues: LifestyleChangeFormValues = {
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
  } = useForm<LifestyleChangeFormValues>({
    resolver: zodResolver(lifestyleChangeFormSchema),
    defaultValues,
    mode: "onSubmit",
  });

  // Local mirror of the field selector so we don't call RHF's `watch`
  // (react-compiler flags it as not memoizable).
  const [activeField, setActiveField] =
    useState<LifestyleTrendFieldKey>(startField);

  const activeOptions = enumOptionsFor(activeField);
  const availableEnumOptions = activeOptions
    ? activeOptions.filter((o) => o.value !== currentValueOf(activeField))
    : null;

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

  const formKeys: ReadonlyArray<keyof LifestyleChangeFormValues> = [
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
      res = await fetch("/api/lifestyle/changes", {
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
      // value_unchanged: the server's current value IS what was submitted —
      // not a parallel write, just a no-op. Say so on the field instead of the
      // "changed elsewhere" state (which discards the typed reason).
      if (errBody.details?.currentValue === values.newValue) {
        setError("newValue", {
          message: "That's already the current value — change it or cancel.",
        });
        return;
      }
      setState({
        kind: "stale-value",
        field: errBody.details?.field ?? "value",
        currentValue: errBody.details?.currentValue ?? "unknown",
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
          setError(k as keyof LifestyleChangeFormValues, { message: msgs[0] });
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
            {state.kind === "stale-value"
              ? "Value changed elsewhere"
              : "Log a lifestyle change"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {state.kind === "stale-value"
              ? `The current value is already "${trendValueLabel(state.field, state.currentValue)}". Refresh to see the latest state.`
              : "Records a change in the lifestyle trend history."}
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
              id="lifestyle-log-change-form"
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
                      items={TREND_FIELD_OPTIONS}
                      onValueChange={(next) => {
                        if (!next) return;
                        const nextField = next as LifestyleTrendFieldKey;
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
                        {TREND_FIELD_OPTIONS.map((opt) => (
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
                {availableEnumOptions ? (
                  <Controller
                    control={control}
                    name="newValue"
                    render={({ field }) => (
                      <Select
                        value={field.value || null}
                        items={availableEnumOptions}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id="newValue" className="w-full">
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableEnumOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                ) : (
                  <Textarea
                    id="newValue"
                    rows={3}
                    placeholder="The updated pattern, in full"
                    aria-invalid={!!errors.newValue}
                    {...register("newValue")}
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
                  placeholder="e.g. doctor advised cutting sugar after the last HbA1c"
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
                form="lifestyle-log-change-form"
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
