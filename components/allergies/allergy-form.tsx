"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  CATEGORY_OPTIONS,
  SEVERITY_OPTIONS,
  STATUS_OPTIONS,
} from "@/components/allergies/allergy-options";
import {
  allergyFormSchema,
  type AllergyFormValues,
} from "@/lib/schemas/forms/allergy";

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
 * Client form for `Add allergy` per design.md 6.12:1848. Clones the Add
 * Condition form (`condition-form.tsx`).
 *
 * Field order follows 6.12 (Substance · Category · Reaction · Severity ·
 * Status · First noted · Notes) with the Confirmed-by doctor field omitted —
 * the §6.12 doctor autocomplete is the standing Phase D carryover; the ref is
 * settable post-create via inline edit on the detail page.
 *
 * Category is required here even though 6.12's rough draft stars only
 * Substance — the locked Phase 4 schema makes it NOT NULL with no default
 * (it scopes AI risk reasoning). The Select starts on a placeholder; the user
 * must pick. Status / Severity have DB defaults (Active / Unknown), so they
 * default in place — no NOT_SET sentinel needed.
 */

interface AllergyFormProps {
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

export function AllergyForm({ patientId }: AllergyFormProps) {
  const router = useRouter();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const defaultValues: AllergyFormValues = {
    substance: "",
    // Category deliberately starts empty (placeholder) — see header note.
    category: "",
    reaction: "",
    severity: "unknown",
    status: "active",
    firstNoted: "",
    notes: "",
  };

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    setError,
    reset,
  } = useForm<AllergyFormValues>({
    resolver: zodResolver(allergyFormSchema),
    defaultValues,
    mode: "onSubmit",
  });

  const formKeys = new Set<string>(Object.keys(defaultValues));

  // Returns true on 201, false on any error (banner/setError already applied).
  const postAllergy = async (values: AllergyFormValues): Promise<boolean> => {
    setBannerError(null);

    // JSON.stringify drops `undefined`, so coerced-empty optionals get omitted
    // from the wire body — matching the server's `.min(1).optional()` contracts.
    const body = {
      substance: values.substance,
      category: values.category,
      reaction: values.reaction?.trim() || undefined,
      severity: values.severity,
      status: values.status,
      firstNoted: values.firstNoted?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
    };

    const res = await fetch("/api/allergies", {
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
          setError(k as keyof AllergyFormValues, { message: msgs[0] });
        } else {
          // Server validated a field the form doesn't render (e.g. the
          // deferred confirmedBy). Surface as banner so the user sees it.
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
    if (!(await postAllergy(values))) return;
    router.push(`/patient/${patientId}/allergies`);
    router.refresh();
  });

  const onSubmitAddAnother = handleSubmit(async (values) => {
    if (!(await postAllergy(values))) return;
    reset(defaultValues);
  });

  const handleCancel = () => {
    if (isDirty) {
      setCancelOpen(true);
    } else {
      router.push(`/patient/${patientId}/allergies`);
    }
  };

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold leading-tight">
            <span className="border-b-2 border-destructive pb-1">
              Add allergy
            </span>
          </h1>
          <p className="mt-4 max-w-prose text-sm text-muted-foreground">
            Direct entry — for AI-assisted entry, describe the allergy in chat.
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
          <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="substance">
            Substance
            <RequiredStar />
          </FieldLabel>
          <Input
            id="substance"
            autoFocus
            autoComplete="off"
            placeholder="Penicillin, peanuts, sulfa drugs…"
            aria-invalid={!!errors.substance}
            {...register("substance")}
          />
          <FieldError
            errors={
              errors.substance ? [{ message: errors.substance.message }] : []
            }
          />
        </Field>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="category">
              Category
              <RequiredStar />
            </FieldLabel>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select
                  value={field.value || null}
                  onValueChange={(next) => field.onChange(next ?? "")}
                  items={CATEGORY_OPTIONS}
                >
                  <SelectTrigger
                    id="category"
                    className="w-full"
                    aria-invalid={!!errors.category}
                  >
                    <SelectValue placeholder="Select category…" />
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
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="reaction">
              Reaction
            </FieldLabel>
            <Input
              id="reaction"
              autoComplete="off"
              placeholder="Hives, anaphylaxis, GI upset…"
              aria-invalid={!!errors.reaction}
              {...register("reaction")}
            />
            <FieldError
              errors={
                errors.reaction ? [{ message: errors.reaction.message }] : []
              }
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="severity">
              Severity
              <LabelHelper text="default Unknown" />
            </FieldLabel>
            <Controller
              control={control}
              name="severity"
              render={({ field }) => (
                <Select
                  value={field.value ?? "unknown"}
                  onValueChange={field.onChange}
                  items={SEVERITY_OPTIONS}
                >
                  <SelectTrigger id="severity" className="w-full">
                    <SelectValue />
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
            <FieldError
              errors={
                errors.severity ? [{ message: errors.severity.message }] : []
              }
            />
          </Field>
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="status">
              Status
              <LabelHelper text="default Active" />
            </FieldLabel>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  value={field.value ?? "active"}
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
              errors={
                errors.status ? [{ message: errors.status.message }] : []
              }
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="firstNoted">
              First noted
              <LabelHelper text="approximate is fine" />
            </FieldLabel>
            <Input
              id="firstNoted"
              type="date"
              aria-invalid={!!errors.firstNoted}
              {...register("firstNoted")}
            />
            <FieldError
              errors={
                errors.firstNoted
                  ? [{ message: errors.firstNoted.message }]
                  : []
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
            placeholder="How it was discovered, what to avoid, cross-reactions a doctor flagged."
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
              If you cancel now, the allergy won&apos;t be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                router.push(`/patient/${patientId}/allergies`);
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
