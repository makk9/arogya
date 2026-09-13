"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  CATEGORY_OPTIONS,
  FORM_OPTIONS,
} from "@/components/medications/medication-options";
import { todayLocal } from "@/lib/datetime";
import { takeExtractionDraft } from "@/lib/extract/draft";
import {
  medicationFormSchema,
  type MedicationFormValues,
} from "@/lib/schemas/forms/medication";

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
 * Client form for `Add medication` per design.md 6.12.
 *
 * Linked-entity fields (prescribingDoctor, purpose) are deliberately omitted
 * in this Phase C item per the Q2 plan decision — those entities have no UI,
 * GET API, or seed data yet. They ship in Phase D with the full autocomplete
 * + `+ Create new` inline-modal pattern.
 *
 * Form schema lives in `@/lib/schemas/forms/medication` per design.md 9.6:2796
 * and derives from `createMedicationSchema` via `.extend()` so required-field
 * constraints stay in lockstep with the API contract.
 */

interface MedicationFormProps {
  patientId: string;
}

// Field labels render in uppercase-mono tracking-wide to match design.md
// 6.12:1826 (`FORM · default Tablet`, `STARTED ON · defaults to today`).
// Helpers (the `· default Tablet` part) reset to normal-case sans-serif so the
// uppercase treatment stays on the label proper.
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

// Maps an "Edit manually instead" extraction draft (§6.11) onto this form's
// values. The draft carries the agent's snake_case fields (§5.4:763); each is
// applied only when present and valid, so a partial/garbled extraction still
// opens a usable form rather than an invalid one. Enum-typed fields (form,
// category) are dropped unless they match a known value — never guessed.
//
// Enum values are sourced from the shared options (the single source of truth,
// typed against the real medication_form / medication_category enums) rather
// than hardcoded — a stale copy previously dropped real values (`other`, `OTC`)
// on prefill. Matched case-insensitively to the canonical value so a lowercased
// `otc` still resolves to `OTC`.
const MED_FORM_VALUES = FORM_OPTIONS.map((o) => o.value);
const MED_CATEGORY_VALUES = CATEGORY_OPTIONS.map((o) => o.value);

function draftStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

function matchEnumValue<T extends string>(
  raw: string | undefined,
  values: readonly T[],
): T | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  return values.find((v) => v.toLowerCase() === lower);
}

function draftToMedicationValues(
  d: Record<string, unknown> | null,
): Partial<MedicationFormValues> {
  if (!d) return {};
  const out: Partial<MedicationFormValues> = {};
  const name = draftStr(d.name);
  if (name) out.name = name;
  const brand = draftStr(d.brand_name);
  if (brand) out.brandName = brand;
  const dose = draftStr(d.current_dose) ?? draftStr(d.dose);
  if (dose) out.currentDose = dose;
  const freq = draftStr(d.current_frequency) ?? draftStr(d.frequency);
  if (freq) out.currentFrequency = freq;
  const form = matchEnumValue(draftStr(d.form), MED_FORM_VALUES);
  if (form) out.form = form;
  const started = draftStr(d.started_on);
  if (started && /^\d{4}-\d{2}-\d{2}$/.test(started)) out.startedOn = started;
  const category = matchEnumValue(draftStr(d.category), MED_CATEGORY_VALUES);
  if (category) out.category = category;
  const purpose = draftStr(d.purpose);
  const notes = [draftStr(d.notes), purpose ? `Purpose: ${purpose}` : undefined]
    .filter(Boolean)
    .join("\n\n");
  if (notes) out.notes = notes;
  return out;
}

export function MedicationForm({
  patientId,
}: MedicationFormProps) {
  const router = useRouter();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  // Single-use read of an "Edit manually instead" hand-off draft (§6.11). Read
  // once in a state initializer so React StrictMode's double-invoke doesn't
  // consume-and-clear it before the values are applied.
  const [draft] = useState(() => takeExtractionDraft("medication"));

  // Blank form — what "Save and add another" resets to. The extraction draft
  // is a single-use prefill; re-applying it would invite a duplicate save.
  const blankDefaults: MedicationFormValues = {
    name: "",
    brandName: "",
    currentDose: "",
    currentFrequency: "",
    form: "tablet",
    // The StartedOn field renders as a native <input type="date"> in the
    // user's browser locale — the user is picking a calendar day, not an
    // instant. Defaults to browser-local "today" (user-tz form defaults per
    // decisions.md 2026-06-10, superseding the 9.6 patient-tz default that
    // pre-filled tomorrow's Pune date for an evening US session).
    startedOn: todayLocal(),
    category: "allopathic",
    notes: "",
  };
  const defaultValues: MedicationFormValues = {
    ...blankDefaults,
    ...draftToMedicationValues(draft),
  };

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    setError,
    reset,
  } = useForm<MedicationFormValues>({
    resolver: zodResolver(medicationFormSchema),
    defaultValues,
    mode: "onSubmit",
  });

  const formKeys = new Set<string>(Object.keys(defaultValues));

  // Returns true on 201, false on any error (banner/setError already applied).
  const postMedication = async (
    values: MedicationFormValues,
  ): Promise<boolean> => {
    setBannerError(null);

    // JSON.stringify drops `undefined` values, so empty optional strings get
    // omitted from the wire body — matching the server's `.min(1).optional()`
    // contract that rejects "" but accepts the field being absent.
    const body = {
      name: values.name,
      currentDose: values.currentDose,
      currentFrequency: values.currentFrequency,
      category: values.category,
      brandName: values.brandName?.trim() || undefined,
      form: values.form,
      startedOn: values.startedOn?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
    };

    const res = await fetch("/api/medications", {
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
        if (formKeys.has(k)) {
          setError(k as keyof MedicationFormValues, { message: msgs[0] });
        } else {
          // Server validated a field the form doesn't render (e.g. an
          // optional linked-entity field). Surface as banner so the user
          // sees the error instead of it landing on an invisible field.
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
    if (!(await postMedication(values))) return;
    router.push(`/patient/${patientId}/medications`);
    router.refresh();
  });

  const onSubmitAddAnother = handleSubmit(async (values) => {
    if (!(await postMedication(values))) return;
    reset(blankDefaults);
    // Stay on the form, but refresh the server tree so the rail counts update.
    router.refresh();
  });

  const handleCancel = () => {
    if (isDirty) {
      setCancelOpen(true);
    } else {
      router.push(`/patient/${patientId}/medications`);
    }
  };

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold leading-tight">
            <span className="border-b-2 border-destructive pb-1">
              Add medication
            </span>
          </h1>
          <p className="mt-4 max-w-prose text-sm text-muted-foreground">
            Direct entry — for AI-assisted entry, paste a prescription into
            chat.
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

      <form
        noValidate
        onSubmit={onSubmitSave}
        className="flex flex-col gap-6"
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="name">
              Name
              <RequiredStar />
            </FieldLabel>
            <Input
              id="name"
              autoFocus
              autoComplete="off"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            <FieldError
              errors={errors.name ? [{ message: errors.name.message }] : []}
            />
          </Field>
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="brandName">Brand name</FieldLabel>
            <Input
              id="brandName"
              autoComplete="off"
              aria-invalid={!!errors.brandName}
              {...register("brandName")}
            />
            <FieldError
              errors={
                errors.brandName
                  ? [{ message: errors.brandName.message }]
                  : []
              }
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="currentDose">
              Dose
              <RequiredStar />
            </FieldLabel>
            <Input
              id="currentDose"
              placeholder="e.g. 10 mg"
              autoComplete="off"
              aria-invalid={!!errors.currentDose}
              {...register("currentDose")}
            />
            <FieldError
              errors={
                errors.currentDose
                  ? [{ message: errors.currentDose.message }]
                  : []
              }
            />
          </Field>
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="currentFrequency">
              Frequency
              <RequiredStar />
            </FieldLabel>
            <Input
              id="currentFrequency"
              placeholder="e.g. once daily morning"
              autoComplete="off"
              aria-invalid={!!errors.currentFrequency}
              {...register("currentFrequency")}
            />
            <FieldError
              errors={
                errors.currentFrequency
                  ? [{ message: errors.currentFrequency.message }]
                  : []
              }
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="form">
              Form<LabelHelper text="default Tablet" />
            </FieldLabel>
            <Controller
              control={control}
              name="form"
              render={({ field }) => (
                <Select
                  value={field.value ?? "tablet"}
                  items={FORM_OPTIONS}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger id="form" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORM_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError
              errors={errors.form ? [{ message: errors.form.message }] : []}
            />
          </Field>
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="startedOn">
              Started on
              <LabelHelper text="defaults to today" />
              <LabelHelper text="native picker" />
            </FieldLabel>
            <Input
              id="startedOn"
              type="date"
              aria-invalid={!!errors.startedOn}
              {...register("startedOn")}
            />
            <FieldError
              errors={
                errors.startedOn
                  ? [{ message: errors.startedOn.message }]
                  : []
              }
            />
          </Field>
        </div>

        <Field>
          <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="category">
            Category
            <RequiredStar />
            <LabelHelper text="default Allopathic" />
          </FieldLabel>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select
                value={field.value}
                items={CATEGORY_OPTIONS}
                onValueChange={field.onChange}
              >
                <SelectTrigger id="category" className="w-full md:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
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
              errors.category ? [{ message: errors.category.message }] : []
            }
          />
        </Field>

        <Field>
          <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="notes">Notes</FieldLabel>
          <Textarea
            id="notes"
            rows={4}
            placeholder="How to take, observed side effects, compliance issues."
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
              If you cancel now, the medication won&apos;t be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                router.push(`/patient/${patientId}/medications`);
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
