"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  STATUS_OPTIONS,
  VISIT_TYPE_OPTIONS,
} from "@/components/visits/visit-options";
import { NOT_SET } from "@/components/conditions/condition-options";
import { todayLocal } from "@/lib/datetime";
import { displayDoctorName } from "@/lib/doctor-display";
import {
  visitFormSchema,
  type VisitFormValues,
} from "@/lib/schemas/forms/visit";
import { draftDate, draftEnum, draftString, takeExtractionDraft } from "@/lib/extract/draft";

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
 * Client form for `Log visit` per design.md 6.12:1855 — the first event-entity
 * form. Clones the Add Allergy form shell; field-set rationale lives in
 * lib/schemas/forms/visit.ts (full Phase 4 set; no duration column).
 *
 * Doctor is a required plain Select (name + specialty) — the §6.12 rich
 * autocomplete is the standing carryover. The parent page guards the
 * zero-doctors state, so `doctors` is non-empty here.
 */

export interface DoctorOption {
  id: string;
  name: string;
  specialty: string;
}

interface VisitFormProps {
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

// Maps an "Edit manually instead" extraction draft (§6.11). The agent extracts
// visit_date/doctor/reason/summary/notes. `doctor` is a free-text name and the
// form's Doctor field is a UUID picker, so it's left for the user to select
// (per the "prefill plain fields, leave entity-links blank" rule).
const VISIT_TYPES = [
  "routine_followup", "new_consultation", "urgent", "specialist_referral",
  "second_opinion", "telemedicine", "hospitalization", "surgery",
] as const;

function draftToVisitValues(
  d: Record<string, unknown> | null,
): Partial<VisitFormValues> {
  if (!d) return {};
  const out: Partial<VisitFormValues> = {};
  const visitDate = draftDate(d.visit_date);
  if (visitDate) out.visitDate = visitDate;
  const visitType = draftEnum(d.visit_type, VISIT_TYPES);
  if (visitType) out.visitType = visitType;
  const reason = draftString(d.reason);
  if (reason) out.chiefComplaint = reason;
  const summary = draftString(d.summary);
  if (summary) out.summary = summary;
  const notes = draftString(d.notes);
  if (notes) out.notes = notes;
  return out;
}

export function VisitForm({ patientId, doctors }: VisitFormProps) {
  const [draft] = useState(() => takeExtractionDraft("visit"));
  const router = useRouter();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const doctorItems = doctors.map((d) => ({
    value: d.id,
    label: `${displayDoctorName(d.name)} · ${d.specialty}`,
  }));

  // The optional visit-type Select carries a "—" clear row (NOT_SET sentinel),
  // since a native-less Select can't be un-picked once touched.
  const typeItems = [
    { value: NOT_SET, label: "—" },
    ...VISIT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];

  const defaultValues: VisitFormValues = {
    doctorId: "",
    visitDate: todayLocal(),
    visitType: "",
    status: "completed",
    chiefComplaint: "",
    summary: "",
    diagnosisText: "",
    nextSteps: "",
    notes: "",
    ...draftToVisitValues(draft),
  };

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    setError,
    reset,
  } = useForm<VisitFormValues>({
    resolver: zodResolver(visitFormSchema),
    defaultValues,
    mode: "onSubmit",
  });

  const formKeys = new Set<string>(Object.keys(defaultValues));

  // Returns true on 201, false on any error (banner/setError already applied).
  const postVisit = async (values: VisitFormValues): Promise<boolean> => {
    setBannerError(null);

    // JSON.stringify drops `undefined`, so coerced-empty optionals get omitted
    // from the wire body — matching the server's `.min(1).optional()` contracts.
    const body = {
      doctorId: values.doctorId,
      visitDate: values.visitDate,
      visitType: values.visitType || undefined,
      status: values.status,
      chiefComplaint: values.chiefComplaint?.trim() || undefined,
      summary: values.summary?.trim() || undefined,
      diagnosisText: values.diagnosisText?.trim() || undefined,
      nextSteps: values.nextSteps?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
    };

    const res = await fetch("/api/visits", {
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
          setError(k as keyof VisitFormValues, { message: msgs[0] });
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
    if (!(await postVisit(values))) return;
    router.push(`/patient/${patientId}/visits`);
    router.refresh();
  });

  const onSubmitAddAnother = handleSubmit(async (values) => {
    if (!(await postVisit(values))) return;
    reset(defaultValues);
  });

  const handleCancel = () => {
    if (isDirty) {
      setCancelOpen(true);
    } else {
      router.push(`/patient/${patientId}/visits`);
    }
  };

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold leading-tight">
            <span className="border-b-2 border-destructive pb-1">
              Log visit
            </span>
          </h1>
          <p className="mt-4 max-w-prose text-sm text-muted-foreground">
            Direct entry — for AI-assisted entry, describe the visit in chat.
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
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="doctorId">
              Doctor
              <RequiredStar />
            </FieldLabel>
            <Controller
              control={control}
              name="doctorId"
              render={({ field }) => (
                <Select
                  value={field.value || null}
                  onValueChange={(next) => field.onChange(next ?? "")}
                  items={doctorItems}
                >
                  <SelectTrigger
                    id="doctorId"
                    className="w-full"
                    aria-invalid={!!errors.doctorId}
                  >
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
            <FieldError
              errors={
                errors.doctorId ? [{ message: errors.doctorId.message }] : []
              }
            />
          </Field>
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="visitDate">
              Visit date
              <RequiredStar />
              <LabelHelper text="defaults to today" />
            </FieldLabel>
            <Input
              id="visitDate"
              type="date"
              aria-invalid={!!errors.visitDate}
              {...register("visitDate")}
            />
            <FieldError
              errors={
                errors.visitDate ? [{ message: errors.visitDate.message }] : []
              }
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="visitType">
              Visit type
            </FieldLabel>
            <Controller
              control={control}
              name="visitType"
              render={({ field }) => (
                <Select
                  value={field.value || NOT_SET}
                  onValueChange={(next) =>
                    field.onChange(next === NOT_SET || !next ? "" : next)
                  }
                  items={typeItems}
                >
                  <SelectTrigger id="visitType" className="w-full">
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
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="status">
              Status
              <LabelHelper text="default Completed" />
            </FieldLabel>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  value={field.value ?? "completed"}
                  onValueChange={field.onChange}
                  items={STATUS_OPTIONS}
                >
                  <SelectTrigger id="status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError
              errors={errors.status ? [{ message: errors.status.message }] : []}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="chiefComplaint">
            Chief complaint
          </FieldLabel>
          <Input
            id="chiefComplaint"
            autoComplete="off"
            placeholder="Why the visit happened — dizziness, BP check, follow-up…"
            aria-invalid={!!errors.chiefComplaint}
            {...register("chiefComplaint")}
          />
          <FieldError
            errors={
              errors.chiefComplaint
                ? [{ message: errors.chiefComplaint.message }]
                : []
            }
          />
        </Field>

        <Field>
          <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="summary">
            Summary
          </FieldLabel>
          <Textarea
            id="summary"
            rows={5}
            placeholder="What happened — the doctor's observations, what was discussed, readings taken."
            aria-invalid={!!errors.summary}
            {...register("summary")}
          />
          <FieldError
            errors={errors.summary ? [{ message: errors.summary.message }] : []}
          />
        </Field>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="diagnosisText">
              Diagnosis
              <LabelHelper text="as the doctor stated it" />
            </FieldLabel>
            <Input
              id="diagnosisText"
              autoComplete="off"
              placeholder="Hypertension, suboptimal control…"
              aria-invalid={!!errors.diagnosisText}
              {...register("diagnosisText")}
            />
            <FieldError
              errors={
                errors.diagnosisText
                  ? [{ message: errors.diagnosisText.message }]
                  : []
              }
            />
          </Field>
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="nextSteps">
              Next steps
            </FieldLabel>
            <Input
              id="nextSteps"
              autoComplete="off"
              placeholder="Recheck in 8 weeks, schedule lipid panel…"
              aria-invalid={!!errors.nextSteps}
              {...register("nextSteps")}
            />
            <FieldError
              errors={
                errors.nextSteps ? [{ message: errors.nextSteps.message }] : []
              }
            />
          </Field>
        </div>

        <Field>
          <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="notes">
            Notes
          </FieldLabel>
          <Textarea
            id="notes"
            rows={4}
            placeholder="Your own observations — how he seemed, what the doctor didn't say."
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
              If you cancel now, the visit won&apos;t be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                router.push(`/patient/${patientId}/visits`);
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
