"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { NOT_SET } from "@/components/conditions/condition-options";
import {
  CONTEXT_OPTIONS,
  DEFAULT_UNIT,
  FLAG_OPTIONS,
  READING_TYPE_OPTIONS,
  TWO_VALUE_TYPES,
} from "@/components/vitals/vital-options";
import { vitalFormSchema, type VitalFormValues } from "@/lib/schemas/forms/vital";

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
import { Button } from "@/components/ui/button";
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

/*
 * Client form for `Log reading` — the VitalReading create surface. Vitals have
 * no §6.12 wireframe (quick-log surface, §4:412) and no list/detail page, so
 * this form is the only vital UI in v1; it clones the Log-visit form shell.
 *
 * Two-value reading types (blood pressure) reveal a secondary input
 * (systolic / diastolic); changing the reading type pre-fills the unit from
 * DEFAULT_UNIT but leaves it editable.
 */

interface VitalFormProps {
  patientId: string;
}

const FIELD_LABEL_CLASS =
  "text-xs uppercase tracking-wide font-mono text-foreground";

function RequiredStar() {
  return (
    <span aria-hidden className="ml-0.5 text-destructive">
      *
    </span>
  );
}

function LabelHelper({ text }: { text: string }) {
  return (
    <span className="ml-2 text-xs font-sans font-normal normal-case tracking-normal text-muted-foreground">
      · {text}
    </span>
  );
}

// "now" as a datetime-local value (YYYY-MM-DDTHH:mm) in the browser's timezone —
// the default for `recorded_at`, which the submit handler converts to ISO.
function nowLocalDatetime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function VitalForm({ patientId }: VitalFormProps) {
  const router = useRouter();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const contextItems = [
    { value: NOT_SET, label: "—" },
    ...CONTEXT_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];
  const flagItems = [
    { value: NOT_SET, label: "—" },
    ...FLAG_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];

  const defaultValues: VitalFormValues = {
    readingType: "blood_pressure",
    recordedAtLocal: nowLocalDatetime(),
    valuePrimary: "",
    valueSecondary: "",
    unit: DEFAULT_UNIT.blood_pressure,
    context: "",
    flag: "",
    notes: "",
  };

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, isDirty },
    setError,
    reset,
  } = useForm<VitalFormValues>({
    resolver: zodResolver(vitalFormSchema),
    defaultValues,
    mode: "onSubmit",
  });

  // useWatch (not the useForm `watch` fn) — memoization-safe under React Compiler.
  const readingType = useWatch({ control, name: "readingType" });
  const twoValue = TWO_VALUE_TYPES.has(readingType);
  const formKeys = new Set<string>(Object.keys(defaultValues));

  // Returns true on 201, false on any error (banner/setError already applied).
  const postReading = async (values: VitalFormValues): Promise<boolean> => {
    setBannerError(null);

    const body = {
      readingType: values.readingType,
      // datetime-local (browser tz) → full ISO with offset for the timestamptz.
      recordedAt: new Date(values.recordedAtLocal).toISOString(),
      valuePrimary: values.valuePrimary.trim() || undefined,
      valueSecondary:
        twoValue && values.valueSecondary.trim()
          ? values.valueSecondary.trim()
          : undefined,
      unit: values.unit.trim(),
      context: values.context || undefined,
      flag: values.flag || undefined,
      notes: values.notes.trim() || undefined,
    };

    const res = await fetch("/api/vital-readings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) return true;

    const parsed = (await res.json().catch(() => ({}))) as {
      error?: {
        code?: string;
        message?: string;
        details?: {
          formErrors?: string[];
          fieldErrors?: Record<string, string[]>;
        };
      };
    };
    const errBody = parsed.error;
    if (errBody?.code === "validation_failed" && errBody.details) {
      const unknownFieldMessages: string[] = [];
      for (const [k, msgs] of Object.entries(errBody.details.fieldErrors ?? {})) {
        if (!msgs[0]) continue;
        // The wire field `recordedAt` maps back to the form's recordedAtLocal.
        const formKey = k === "recordedAt" ? "recordedAtLocal" : k;
        if (formKeys.has(formKey)) {
          setError(formKey as keyof VitalFormValues, { message: msgs[0] });
        } else {
          unknownFieldMessages.push(`${k}: ${msgs[0]}`);
        }
      }
      const formErrs = errBody.details.formErrors ?? [];
      const allBannerMessages = [...formErrs, ...unknownFieldMessages];
      if (allBannerMessages.length) setBannerError(allBannerMessages.join("; "));
    } else {
      setBannerError(errBody?.message ?? "Something went wrong. Try again.");
    }
    return false;
  };

  const onSubmitSave = handleSubmit(async (values) => {
    if (!(await postReading(values))) return;
    // No vitals list page — return to the patient's symptoms timeline, the
    // nearest surface where readings show up (as `●` pills on episodes).
    router.push(`/patient/${patientId}/symptoms`);
    router.refresh();
  });

  const onSubmitAddAnother = handleSubmit(async (values) => {
    if (!(await postReading(values))) return;
    reset({ ...defaultValues, recordedAtLocal: nowLocalDatetime() });
  });

  const handleCancel = () => {
    if (isDirty) setCancelOpen(true);
    else router.push(`/patient/${patientId}/symptoms`);
  };

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold leading-tight">
            <span className="border-b-2 border-destructive pb-1">Log reading</span>
          </h1>
          <p className="mt-4 max-w-prose text-sm text-muted-foreground">
            A blood pressure, weight, glucose, or other reading taken at home.
            For AI-assisted entry, describe it in chat.
          </p>
        </div>
        <Button
          type="button"
          variant="link"
          onClick={handleCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>

      {bannerError && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {bannerError}
        </div>
      )}

      <form noValidate onSubmit={onSubmitSave} className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="readingType">
              Reading type
              <RequiredStar />
            </FieldLabel>
            <Controller
              control={control}
              name="readingType"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(next) => {
                    if (!next) return;
                    field.onChange(next);
                    // Pre-fill the unit suggestion for the chosen type.
                    const unit = DEFAULT_UNIT[next as keyof typeof DEFAULT_UNIT];
                    if (unit !== undefined) setValue("unit", unit);
                  }}
                  items={READING_TYPE_OPTIONS}
                >
                  <SelectTrigger id="readingType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {READING_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="recordedAtLocal">
              Recorded at
              <RequiredStar />
              <LabelHelper text="defaults to now" />
            </FieldLabel>
            <Input
              id="recordedAtLocal"
              type="datetime-local"
              aria-invalid={!!errors.recordedAtLocal}
              {...register("recordedAtLocal")}
            />
            <FieldError
              errors={
                errors.recordedAtLocal
                  ? [{ message: errors.recordedAtLocal.message }]
                  : []
              }
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="valuePrimary">
              {twoValue ? "Systolic" : "Value"}
              <RequiredStar />
            </FieldLabel>
            <Input
              id="valuePrimary"
              inputMode="decimal"
              autoComplete="off"
              placeholder={twoValue ? "120" : "72"}
              aria-invalid={!!errors.valuePrimary}
              {...register("valuePrimary")}
            />
            <FieldError
              errors={
                errors.valuePrimary
                  ? [{ message: errors.valuePrimary.message }]
                  : []
              }
            />
          </Field>
          {twoValue ? (
            <Field>
              <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="valueSecondary">
                Diastolic
              </FieldLabel>
              <Input
                id="valueSecondary"
                inputMode="decimal"
                autoComplete="off"
                placeholder="80"
                aria-invalid={!!errors.valueSecondary}
                {...register("valueSecondary")}
              />
              <FieldError
                errors={
                  errors.valueSecondary
                    ? [{ message: errors.valueSecondary.message }]
                    : []
                }
              />
            </Field>
          ) : null}
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="unit">
              Unit
              <RequiredStar />
            </FieldLabel>
            <Input
              id="unit"
              autoComplete="off"
              placeholder="mmHg, kg, mg/dL…"
              aria-invalid={!!errors.unit}
              {...register("unit")}
            />
            <FieldError
              errors={errors.unit ? [{ message: errors.unit.message }] : []}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="context">
              Context
            </FieldLabel>
            <Controller
              control={control}
              name="context"
              render={({ field }) => (
                <Select
                  value={field.value || NOT_SET}
                  onValueChange={(next) =>
                    field.onChange(next === NOT_SET || !next ? "" : next)
                  }
                  items={contextItems}
                >
                  <SelectTrigger id="context" className="w-full">
                    <SelectValue placeholder="When it was taken…" />
                  </SelectTrigger>
                  <SelectContent>
                    {contextItems.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="flag">
              Flag
              <LabelHelper text="if out of range" />
            </FieldLabel>
            <Controller
              control={control}
              name="flag"
              render={({ field }) => (
                <Select
                  value={field.value || NOT_SET}
                  onValueChange={(next) =>
                    field.onChange(next === NOT_SET || !next ? "" : next)
                  }
                  items={flagItems}
                >
                  <SelectTrigger id="flag" className="w-full">
                    <SelectValue placeholder="Normal…" />
                  </SelectTrigger>
                  <SelectContent>
                    {flagItems.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="notes">
            Notes
          </FieldLabel>
          <Textarea
            id="notes"
            rows={3}
            placeholder="Felt dizzy, after morning walk, missed med last night…"
            aria-invalid={!!errors.notes}
            {...register("notes")}
          />
          <FieldError
            errors={errors.notes ? [{ message: errors.notes.message }] : []}
          />
        </Field>

        <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-6">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isSubmitting}
            onClick={() => {
              void onSubmitAddAnother();
            }}
          >
            + Save and add another
          </Button>
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
            <AlertDialogDescription>
              If you cancel now, the reading won&apos;t be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                router.push(`/patient/${patientId}/symptoms`);
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
