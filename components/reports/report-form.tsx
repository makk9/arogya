"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { NOT_SET, REPORT_TYPE_OPTIONS } from "@/components/reports/report-options";
import { todayLocal } from "@/lib/datetime";
import {
  reportFormSchema,
  type ReportFormValues,
} from "@/lib/schemas/forms/report";

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
 * Client form for `Log report` per design.md 6.12:1860 — Title · Report type ·
 * Date issued · Linked visit · Content · Notes (plus optional Linked doctor for
 * the document's author/source, §4:491). Clones the Log Visit form shell;
 * field-set rationale lives in lib/schemas/forms/report.ts.
 *
 * "Source file" (§6.12) is deferred to Phase E with the upload/extraction
 * pipeline — this is text-only entry. Linked visit / doctor are optional plain
 * Selects of the patient's visits / doctors (the §6.12 rich autocomplete is the
 * standing carryover); both carry a "—" clear row.
 */

export interface ReportDoctorOption {
  id: string;
  label: string;
}

export interface ReportVisitOption {
  id: string;
  label: string;
}

interface ReportFormProps {
  patientId: string;
  doctors: ReadonlyArray<ReportDoctorOption>;
  visits: ReadonlyArray<ReportVisitOption>;
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

export function ReportForm({ patientId, doctors, visits }: ReportFormProps) {
  const router = useRouter();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  // Optional selects carry a leading "—" clear row (NOT_SET sentinel), since a
  // native-less Select can't be un-picked once touched.
  const typeItems = [
    { value: NOT_SET, label: "—" },
    ...REPORT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];
  const doctorItems = [
    { value: NOT_SET, label: "—" },
    ...doctors.map((d) => ({ value: d.id, label: d.label })),
  ];
  const visitItems = [
    { value: NOT_SET, label: "—" },
    ...visits.map((v) => ({ value: v.id, label: v.label })),
  ];

  const defaultValues: ReportFormValues = {
    title: "",
    reportDate: todayLocal(),
    reportType: "",
    linkedVisitId: "",
    linkedDoctorId: "",
    content: "",
    notes: "",
  };

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    setError,
    reset,
  } = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues,
    mode: "onSubmit",
  });

  const formKeys = new Set<string>(Object.keys(defaultValues));

  // Returns true on 201, false on any error (banner/setError already applied).
  const postReport = async (values: ReportFormValues): Promise<boolean> => {
    setBannerError(null);

    // JSON.stringify drops `undefined`, so coerced-empty optionals get omitted
    // from the wire body — matching the server's `.min(1).optional()` contracts.
    const body = {
      title: values.title.trim(),
      reportDate: values.reportDate,
      reportType: values.reportType || undefined,
      linkedVisitId: values.linkedVisitId || undefined,
      linkedDoctorId: values.linkedDoctorId || undefined,
      content: values.content?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
    };

    const res = await fetch("/api/reports", {
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
      for (const [k, msgs] of Object.entries(
        errBody.details.fieldErrors ?? {},
      )) {
        if (!msgs[0]) continue;
        if (formKeys.has(k)) {
          setError(k as keyof ReportFormValues, { message: msgs[0] });
        } else {
          unknownFieldMessages.push(`${k}: ${msgs[0]}`);
        }
      }
      const formErrs = errBody.details.formErrors ?? [];
      const allBannerMessages = [...formErrs, ...unknownFieldMessages];
      if (allBannerMessages.length) {
        setBannerError(allBannerMessages.join("; "));
      }
    } else {
      setBannerError(errBody?.message ?? "Something went wrong. Try again.");
    }
    return false;
  };

  const onSubmitSave = handleSubmit(async (values) => {
    if (!(await postReport(values))) return;
    router.push(`/patient/${patientId}/reports`);
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
      router.push(`/patient/${patientId}/reports`);
    }
  };

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold leading-tight">
            <span className="border-b-2 border-destructive pb-1">
              Log report
            </span>
          </h1>
          <p className="mt-4 max-w-prose text-sm text-muted-foreground">
            Direct entry — for AI-assisted entry, upload the document or describe
            it in chat.
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
        <Field>
          <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="title">
            Title
            <RequiredStar />
          </FieldLabel>
          <Input
            id="title"
            autoComplete="off"
            placeholder="Discharge summary — Apollo, Apr 12"
            aria-invalid={!!errors.title}
            {...register("title")}
          />
          <FieldError
            errors={errors.title ? [{ message: errors.title.message }] : []}
          />
        </Field>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="reportType">
              Report type
            </FieldLabel>
            <Controller
              control={control}
              name="reportType"
              render={({ field }) => (
                <Select
                  value={field.value || NOT_SET}
                  onValueChange={(next) =>
                    field.onChange(next === NOT_SET || !next ? "" : next)
                  }
                  items={typeItems}
                >
                  <SelectTrigger id="reportType" className="w-full">
                    <SelectValue placeholder="Select type…" />
                  </SelectTrigger>
                  <SelectContent>
                    {typeItems.map((opt) => (
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
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="reportDate">
              Date issued
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
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="linkedVisitId">
              Linked visit
            </FieldLabel>
            <Controller
              control={control}
              name="linkedVisitId"
              render={({ field }) => (
                <Select
                  value={field.value || NOT_SET}
                  onValueChange={(next) =>
                    field.onChange(next === NOT_SET || !next ? "" : next)
                  }
                  items={visitItems}
                >
                  <SelectTrigger id="linkedVisitId" className="w-full">
                    <SelectValue placeholder="Select visit…" />
                  </SelectTrigger>
                  <SelectContent>
                    {visitItems.map((opt) => (
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
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="linkedDoctorId">
              Linked doctor
              <LabelHelper text="author / source" />
            </FieldLabel>
            <Controller
              control={control}
              name="linkedDoctorId"
              render={({ field }) => (
                <Select
                  value={field.value || NOT_SET}
                  onValueChange={(next) =>
                    field.onChange(next === NOT_SET || !next ? "" : next)
                  }
                  items={doctorItems}
                >
                  <SelectTrigger id="linkedDoctorId" className="w-full">
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

        <Field>
          <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="content">
            Content
            <LabelHelper text="the document's text — markdown supported" />
          </FieldLabel>
          <Textarea
            id="content"
            rows={8}
            placeholder="Paste or transcribe what the document says."
            aria-invalid={!!errors.content}
            {...register("content")}
          />
          <FieldError
            errors={errors.content ? [{ message: errors.content.message }] : []}
          />
        </Field>

        <Field>
          <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="notes">
            Notes
          </FieldLabel>
          <Textarea
            id="notes"
            rows={4}
            placeholder="Your own annotations — why this document matters, what to follow up on."
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
              If you cancel now, the report won&apos;t be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                router.push(`/patient/${patientId}/reports`);
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
