"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import {
  doctorFormSchema,
  type DoctorFormValues,
} from "@/lib/schemas/forms/doctor";
import { draftString, takeExtractionDraft } from "@/lib/extract/draft";

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
import { Textarea } from "@/components/ui/textarea";

/*
 * Client form for `Add doctor` per design.md 6.12:1846. Clones the Add
 * Condition form (`condition-form.tsx`) — simpler, since Doctor has no enums:
 * every field is a text/date input, so there are no Selects and no NOT_SET
 * sentinel plumbing.
 *
 * Email is omitted per the 6.12 field set (editable later on the detail grid).
 * Specialty's "autocomplete" annotation is deferred (free text in v1, same as
 * the medication form's name autocomplete).
 *
 * Form schema lives in `@/lib/schemas/forms/doctor` and derives from
 * `createDoctorSchema` so required-field constraints stay in lockstep with the
 * API contract.
 */

interface DoctorFormProps {
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

// Maps an "Edit manually instead" extraction draft (§6.11). The agent extracts
// name/specialty/notes for a doctor.
function draftToDoctorValues(
  d: Record<string, unknown> | null,
): Partial<DoctorFormValues> {
  if (!d) return {};
  const out: Partial<DoctorFormValues> = {};
  const name = draftString(d.name);
  if (name) out.name = name;
  const specialty = draftString(d.specialty);
  if (specialty) out.specialty = specialty;
  const notes = draftString(d.notes);
  if (notes) out.notes = notes;
  return out;
}

export function DoctorForm({ patientId }: DoctorFormProps) {
  const [draft] = useState(() => takeExtractionDraft("doctor"));
  const router = useRouter();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  // Blank form — what "Save and add another" resets to. The extraction draft
  // is a single-use prefill; re-applying it would invite a duplicate save.
  const blankDefaults: DoctorFormValues = {
    name: "",
    specialty: "",
    clinic: "",
    phone: "",
    address: "",
    // First visit has no default (unlike medication's Started on): the first
    // visit to a long-standing doctor is usually historical, often unknown.
    firstVisit: "",
    notes: "",
  };
  const defaultValues: DoctorFormValues = {
    ...blankDefaults,
    ...draftToDoctorValues(draft),
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    setError,
    reset,
  } = useForm<DoctorFormValues>({
    resolver: zodResolver(doctorFormSchema),
    defaultValues,
    mode: "onSubmit",
  });

  const formKeys = new Set<string>(Object.keys(defaultValues));

  // Returns true on 201, false on any error (banner/setError already applied).
  const postDoctor = async (values: DoctorFormValues): Promise<boolean> => {
    setBannerError(null);

    // JSON.stringify drops `undefined`, so coerced-empty optionals get omitted
    // from the wire body — matching the server's `.min(1).optional()` contracts.
    const body = {
      name: values.name,
      specialty: values.specialty,
      clinic: values.clinic?.trim() || undefined,
      phone: values.phone?.trim() || undefined,
      address: values.address?.trim() || undefined,
      firstVisit: values.firstVisit?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
    };

    const res = await fetch("/api/doctors", {
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
          setError(k as keyof DoctorFormValues, { message: msgs[0] });
        } else {
          // Server validated a field the form doesn't render (e.g. email).
          // Surface as banner so the user sees it instead of it landing on an
          // invisible field.
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
    if (!(await postDoctor(values))) return;
    router.push(`/patient/${patientId}/doctors`);
    router.refresh();
  });

  const onSubmitAddAnother = handleSubmit(async (values) => {
    if (!(await postDoctor(values))) return;
    reset(blankDefaults);
    // Stay on the form, but refresh the server tree so the rail counts update.
    router.refresh();
  });

  const handleCancel = () => {
    if (isDirty) {
      setCancelOpen(true);
    } else {
      router.push(`/patient/${patientId}/doctors`);
    }
  };

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold leading-tight">
            <span className="border-b-2 border-destructive pb-1">
              Add doctor
            </span>
          </h1>
          <p className="mt-4 max-w-prose text-sm text-muted-foreground">
            Direct entry — for AI-assisted entry, mention the doctor in chat.
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
          <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="name">
            Name
            <RequiredStar />
          </FieldLabel>
          <Input
            id="name"
            autoFocus
            autoComplete="off"
            placeholder="Dr. Sharma or Priya Sharma"
            aria-invalid={!!errors.name}
            {...register("name")}
          />
          <FieldError
            errors={errors.name ? [{ message: errors.name.message }] : []}
          />
        </Field>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="specialty">
              Specialty
              <RequiredStar />
            </FieldLabel>
            <Input
              id="specialty"
              autoComplete="off"
              placeholder="Cardiology, Ayurveda, General medicine…"
              aria-invalid={!!errors.specialty}
              {...register("specialty")}
            />
            <FieldError
              errors={
                errors.specialty ? [{ message: errors.specialty.message }] : []
              }
            />
          </Field>
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="clinic">
              Clinic / hospital
            </FieldLabel>
            <Input
              id="clinic"
              autoComplete="off"
              aria-invalid={!!errors.clinic}
              {...register("clinic")}
            />
            <FieldError
              errors={errors.clinic ? [{ message: errors.clinic.message }] : []}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="phone">
              Phone
            </FieldLabel>
            <Input
              id="phone"
              type="tel"
              autoComplete="off"
              aria-invalid={!!errors.phone}
              {...register("phone")}
            />
            <FieldError
              errors={errors.phone ? [{ message: errors.phone.message }] : []}
            />
          </Field>
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="firstVisit">
              First visit
              <LabelHelper text="native picker" />
            </FieldLabel>
            <Input
              id="firstVisit"
              type="date"
              aria-invalid={!!errors.firstVisit}
              {...register("firstVisit")}
            />
            <FieldError
              errors={
                errors.firstVisit
                  ? [{ message: errors.firstVisit.message }]
                  : []
              }
            />
          </Field>
        </div>

        <Field>
          <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="address">
            Address
          </FieldLabel>
          <Input
            id="address"
            autoComplete="off"
            aria-invalid={!!errors.address}
            {...register("address")}
          />
          <FieldError
            errors={errors.address ? [{ message: errors.address.message }] : []}
          />
        </Field>

        <Field>
          <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="notes">
            Notes
          </FieldLabel>
          <Textarea
            id="notes"
            rows={4}
            placeholder="Speaks Hindi, prefers WhatsApp, qualifications."
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
              If you cancel now, the doctor won&apos;t be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                router.push(`/patient/${patientId}/doctors`);
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
