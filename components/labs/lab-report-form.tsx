"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";

import { NOT_SET } from "@/components/conditions/condition-options";
import { FLAG_SELECT_ITEMS } from "@/components/labs/lab-options";
import { todayLocal } from "@/lib/datetime";
import { displayDoctorName } from "@/lib/doctor-display";
import {
  EMPTY_MARKER_ROW,
  labReportFormSchema,
  toResultPayload,
  type LabReportFormValues,
} from "@/lib/schemas/forms/lab-report";

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
 * Client form for `Log lab report` per design.md 6.12:1858 — the first form
 * with a nested sub-form (the Markers rows, via useFieldArray). Report-level
 * fields clone the Visit form shell; the markers grid is lab-specific. Source
 * file upload is deferred to the Phase E extraction path (the preferred route
 * for real PDFs); direct entry types markers in.
 *
 * Ordering doctor is optional (a patient may have ordered the panel) — a plain
 * Select with a "—" clear row. The §6.12 rich autocomplete + `+ Create new`
 * modal is the standing Phase D carryover.
 */

export interface DoctorOption {
  id: string;
  name: string;
  specialty: string;
}

interface LabReportFormProps {
  patientId: string;
  doctors: ReadonlyArray<DoctorOption>;
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

const flagItems = FLAG_SELECT_ITEMS;

export function LabReportForm({ patientId, doctors }: LabReportFormProps) {
  const router = useRouter();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const doctorItems = [
    { value: NOT_SET, label: "—" },
    ...doctors.map((d) => ({
      value: d.id,
      label: `${displayDoctorName(d.name)} · ${d.specialty}`,
    })),
  ];

  const defaultValues: LabReportFormValues = {
    reportDate: todayLocal(),
    reportType: "",
    labName: "",
    orderedBy: "",
    notes: "",
    results: [{ ...EMPTY_MARKER_ROW }],
  };

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    setError,
    reset,
  } = useForm<LabReportFormValues>({
    resolver: zodResolver(labReportFormSchema),
    defaultValues,
    mode: "onSubmit",
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "results",
  });

  const topLevelKeys = new Set<string>([
    "reportDate",
    "reportType",
    "labName",
    "orderedBy",
    "notes",
  ]);

  // Returns true on 201, false on any error (banner/setError already applied).
  const postReport = async (values: LabReportFormValues): Promise<boolean> => {
    setBannerError(null);

    const body = {
      reportDate: values.reportDate,
      reportType: values.reportType?.trim() || undefined,
      labName: values.labName?.trim() || undefined,
      orderedBy: values.orderedBy || undefined,
      notes: values.notes?.trim() || undefined,
      results: toResultPayload(values.results),
    };

    const res = await fetch("/api/lab-reports", {
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
      const bannerMessages: string[] = [];
      for (const [k, msgs] of Object.entries(errBody.details.fieldErrors ?? {})) {
        if (!msgs[0]) continue;
        if (topLevelKeys.has(k)) {
          setError(k as keyof LabReportFormValues, { message: msgs[0] });
        } else {
          // Nested marker errors (`results`) collapse here — surfaced in the
          // banner since per-row server paths don't survive Zod's flatten().
          bannerMessages.push(k === "results" ? msgs[0] : `${k}: ${msgs[0]}`);
        }
      }
      const formErrs = errBody.details.formErrors ?? [];
      const all = [...formErrs, ...bannerMessages];
      if (all.length) setBannerError(all.join("; "));
    } else {
      setBannerError(errBody?.message ?? "Something went wrong. Try again.");
    }
    return false;
  };

  const onSubmitSave = handleSubmit(async (values) => {
    if (!(await postReport(values))) return;
    router.push(`/patient/${patientId}/labs`);
    router.refresh();
  });

  const onSubmitAddAnother = handleSubmit(async (values) => {
    if (!(await postReport(values))) return;
    reset(defaultValues);
  });

  const handleCancel = () => {
    if (isDirty) {
      setCancelOpen(true);
    } else {
      router.push(`/patient/${patientId}/labs`);
    }
  };

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold leading-tight">
            <span className="border-b-2 border-destructive pb-1">
              Log lab report
            </span>
          </h1>
          <p className="mt-4 max-w-prose text-sm text-muted-foreground">
            Direct entry — for AI-assisted entry, upload the report in chat.
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
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="reportType">
              Report type
            </FieldLabel>
            <Input
              id="reportType"
              autoComplete="off"
              placeholder="Lipid panel, CBC, Thyroid function…"
              {...register("reportType")}
            />
          </Field>
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="reportDate">
              Date received
              <RequiredStar />
              <LabelHelper text="defaults to today" />
            </FieldLabel>
            <Input
              id="reportDate"
              type="date"
              aria-invalid={!!errors.reportDate}
              {...register("reportDate")}
            />
            <FieldError
              errors={
                errors.reportDate ? [{ message: errors.reportDate.message }] : []
              }
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="labName">
              Lab name
            </FieldLabel>
            <Input
              id="labName"
              autoComplete="off"
              placeholder="Apollo Lab, Thyrocare…"
              {...register("labName")}
            />
          </Field>
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="orderedBy">
              Ordering doctor
            </FieldLabel>
            <Controller
              control={control}
              name="orderedBy"
              render={({ field }) => (
                <Select
                  value={field.value || NOT_SET}
                  onValueChange={(next) =>
                    field.onChange(next === NOT_SET || !next ? "" : next)
                  }
                  items={doctorItems}
                >
                  <SelectTrigger id="orderedBy" className="w-full">
                    <SelectValue placeholder="Select doctor…" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctorItems.map((opt) => (
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

        <fieldset className="flex flex-col gap-3">
          <legend className={`mb-1 ${FIELD_LABEL_CLASS}`}>
            Markers
            <LabelHelper text="one row per measured value" />
          </legend>

          <div className="flex flex-col gap-3">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="rounded-lg border border-border bg-card p-3"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-4">
                    <Input
                      aria-label={`Marker ${index + 1} name`}
                      autoComplete="off"
                      placeholder="Marker — Creatinine, HbA1c…"
                      aria-invalid={!!errors.results?.[index]?.marker}
                      {...register(`results.${index}.marker` as const)}
                    />
                    {errors.results?.[index]?.marker ? (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.results[index]?.marker?.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="sm:col-span-2">
                    <Input
                      aria-label={`Marker ${index + 1} value`}
                      autoComplete="off"
                      placeholder="Value"
                      {...register(`results.${index}.value` as const)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Input
                      aria-label={`Marker ${index + 1} unit`}
                      autoComplete="off"
                      placeholder="Unit"
                      {...register(`results.${index}.unit` as const)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Input
                      aria-label={`Marker ${index + 1} reference low`}
                      autoComplete="off"
                      placeholder="Ref low"
                      aria-invalid={!!errors.results?.[index]?.referenceLow}
                      {...register(`results.${index}.referenceLow` as const)}
                    />
                    {errors.results?.[index]?.referenceLow ? (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.results[index]?.referenceLow?.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="sm:col-span-2">
                    <Input
                      aria-label={`Marker ${index + 1} reference high`}
                      autoComplete="off"
                      placeholder="Ref high"
                      aria-invalid={!!errors.results?.[index]?.referenceHigh}
                      {...register(`results.${index}.referenceHigh` as const)}
                    />
                    {errors.results?.[index]?.referenceHigh ? (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.results[index]?.referenceHigh?.message}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <Controller
                    control={control}
                    name={`results.${index}.flag` as const}
                    render={({ field }) => (
                      <Select
                        value={field.value || NOT_SET}
                        onValueChange={(next) =>
                          field.onChange(next === NOT_SET || !next ? "" : next)
                        }
                        items={flagItems}
                      >
                        <SelectTrigger
                          aria-label={`Marker ${index + 1} flag`}
                          className="h-8 w-40 text-xs"
                        >
                          <SelectValue placeholder="Flag…" />
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={fields.length === 1}
                    onClick={() => remove(index)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => append({ ...EMPTY_MARKER_ROW })}
          >
            + Add marker
          </Button>
        </fieldset>

        <Field>
          <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="notes">
            Notes
          </FieldLabel>
          <Textarea
            id="notes"
            rows={4}
            placeholder="Your own context — what prompted the panel, anything the lab flagged by phone."
            {...register("notes")}
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
              If you cancel now, the lab report won&apos;t be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                router.push(`/patient/${patientId}/labs`);
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
