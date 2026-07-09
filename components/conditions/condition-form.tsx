"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  CATEGORY_OPTIONS,
  NOT_SET,
  SEVERITY_OPTIONS,
  STATUS_OPTIONS,
} from "@/components/conditions/condition-options";
import {
  conditionFormSchema,
  type ConditionFormValues,
} from "@/lib/schemas/forms/condition";
import { draftEnum, draftString, takeExtractionDraft } from "@/lib/extract/draft";

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
 * Client form for `Add condition` per design.md 6.12. Clones the Add Medication
 * form (`medication-form.tsx`) — the Phase C reference state-entity template.
 *
 * Linked-doctor fields (diagnosedBy, managingDoctor) and icdCode are omitted in
 * this Phase D item: the Doctor entity has no autocomplete/GET yet (same reason
 * the medication form deferred prescribingDoctor/purpose), and icdCode is not a
 * 6.12 form field. Managing doctor becomes settable later via `+ Log a change`.
 *
 * Form schema lives in `@/lib/schemas/forms/condition` and derives from
 * `createConditionSchema` via `.omit().extend()` so required-field constraints
 * stay in lockstep with the API contract.
 */

interface ConditionFormProps {
  patientId: string;
}

// Field labels render uppercase-mono tracking-wide to match design.md 6.12:1826.
// Helpers (the `· default Active` part) reset to normal-case sans-serif so the
// uppercase treatment stays on the label proper. Mirrors medication-form.tsx.
const FIELD_LABEL_CLASS =
  "text-xs uppercase tracking-wide font-mono text-foreground";

// Base UI's <SelectValue> renders the raw value unless the <Select> root is
// given an `items` map; with it, the trigger shows the matching option's label.
// Severity + category prepend the "not set" sentinel so its label resolves too.
const SEVERITY_NONE_LABEL = "Not assessed";
const CATEGORY_NONE_LABEL = "Not set";
const SEVERITY_ITEMS = [
  { value: NOT_SET, label: SEVERITY_NONE_LABEL },
  ...SEVERITY_OPTIONS,
];
const CATEGORY_ITEMS = [
  { value: NOT_SET, label: CATEGORY_NONE_LABEL },
  ...CATEGORY_OPTIONS,
];

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

// Maps an "Edit manually instead" extraction draft (§6.11) onto this form. Each
// field applies only when present + valid; enum fields drop unless they match a
// known value (never guessed). The agent extracts name/status/severity/notes.
const CONDITION_STATUSES = ["active", "controlled", "in_remission", "resolved", "suspected"] as const;
const CONDITION_SEVERITIES = ["mild", "moderate", "severe", "unknown"] as const;

function draftToConditionValues(
  d: Record<string, unknown> | null,
): Partial<ConditionFormValues> {
  if (!d) return {};
  const out: Partial<ConditionFormValues> = {};
  const name = draftString(d.name);
  if (name) out.name = name;
  const status = draftEnum(d.status, CONDITION_STATUSES);
  if (status) out.status = status;
  const severity = draftEnum(d.severity, CONDITION_SEVERITIES);
  if (severity) out.severity = severity;
  const notes = draftString(d.notes);
  if (notes) out.notes = notes;
  return out;
}

export function ConditionForm({ patientId }: ConditionFormProps) {
  const [draft] = useState(() => takeExtractionDraft("condition"));
  const router = useRouter();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const defaultValues: ConditionFormValues = {
    name: "",
    status: "active",
    // Severity + category default to the "not set" sentinel — the submit
    // handler coerces it to `undefined` so the server stores null ("not yet
    // assessed" / uncategorized) rather than the literal sentinel string.
    severity: NOT_SET,
    category: NOT_SET,
    // Diagnosed on has no default (unlike medication's Started on): diagnoses
    // are often historical or unknown, so the native picker starts empty.
    diagnosedOn: "",
    notes: "",
    ...draftToConditionValues(draft),
  };

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    setError,
    reset,
  } = useForm<ConditionFormValues>({
    resolver: zodResolver(conditionFormSchema),
    defaultValues,
    mode: "onSubmit",
  });

  const formKeys = new Set<string>(Object.keys(defaultValues));

  // Returns true on 201, false on any error (banner/setError already applied).
  const postCondition = async (
    values: ConditionFormValues,
  ): Promise<boolean> => {
    setBannerError(null);

    // JSON.stringify drops `undefined`, so coerced-empty optionals get omitted
    // from the wire body — matching the server's `.min(1).optional()` /
    // nullable contracts. The NOT_SET sentinel maps to omitted (→ null).
    const body = {
      name: values.name,
      status: values.status,
      severity:
        values.severity && values.severity !== NOT_SET
          ? values.severity
          : undefined,
      category:
        values.category && values.category !== NOT_SET
          ? values.category
          : undefined,
      diagnosedOn: values.diagnosedOn?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
    };

    const res = await fetch("/api/conditions", {
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
          setError(k as keyof ConditionFormValues, { message: msgs[0] });
        } else {
          // Server validated a field the form doesn't render (e.g. a deferred
          // linked-doctor field). Surface as banner so the user sees it instead
          // of it landing on an invisible field.
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
    if (!(await postCondition(values))) return;
    router.push(`/patient/${patientId}/conditions`);
    router.refresh();
  });

  const onSubmitAddAnother = handleSubmit(async (values) => {
    if (!(await postCondition(values))) return;
    reset(defaultValues);
  });

  const handleCancel = () => {
    if (isDirty) {
      setCancelOpen(true);
    } else {
      router.push(`/patient/${patientId}/conditions`);
    }
  };

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold leading-tight">
            <span className="border-b-2 border-destructive pb-1">
              Add condition
            </span>
          </h1>
          <p className="mt-4 max-w-prose text-sm text-muted-foreground">
            Direct entry — for AI-assisted entry, describe the diagnosis in chat.
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
            aria-invalid={!!errors.name}
            {...register("name")}
          />
          <FieldError
            errors={errors.name ? [{ message: errors.name.message }] : []}
          />
        </Field>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
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
              errors={errors.status ? [{ message: errors.status.message }] : []}
            />
          </Field>
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="severity">
              Severity
            </FieldLabel>
            <Controller
              control={control}
              name="severity"
              render={({ field }) => (
                <Select
                  value={field.value ?? NOT_SET}
                  onValueChange={field.onChange}
                  items={SEVERITY_ITEMS}
                >
                  <SelectTrigger id="severity" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NOT_SET}>{SEVERITY_NONE_LABEL}</SelectItem>
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
        </div>

        {/* Field order follows 6.12:1844 with the deferred linked-doctor fields
            removed: Diagnosed on precedes Category. */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="diagnosedOn">
              Diagnosed on
              <LabelHelper text="native picker" />
            </FieldLabel>
            <Input
              id="diagnosedOn"
              type="date"
              aria-invalid={!!errors.diagnosedOn}
              {...register("diagnosedOn")}
            />
            <FieldError
              errors={
                errors.diagnosedOn
                  ? [{ message: errors.diagnosedOn.message }]
                  : []
              }
            />
          </Field>
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="category">
              Category
            </FieldLabel>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select
                  value={field.value ?? NOT_SET}
                  onValueChange={field.onChange}
                  items={CATEGORY_ITEMS}
                >
                  <SelectTrigger id="category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NOT_SET}>{CATEGORY_NONE_LABEL}</SelectItem>
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
        </div>

        <Field>
          <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="notes">
            Notes
          </FieldLabel>
          <Textarea
            id="notes"
            rows={4}
            placeholder="How it presents, management approach, things to watch."
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
              If you cancel now, the condition won&apos;t be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                router.push(`/patient/${patientId}/conditions`);
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
