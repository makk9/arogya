"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { RELATION_OPTIONS } from "@/components/family-history/family-history-options";
import {
  familyHistoryFormSchema,
  type FamilyHistoryFormValues,
} from "@/lib/schemas/forms/family-history";

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
 * Client form for `Add family history` per design.md 6.12:1850 (Relation * ·
 * Relation specific · Condition * · Age of onset · Outcome · Notes). Clones
 * the Add Allergy form (`allergy-form.tsx`).
 *
 * `+ Save and add another` matters most here of all the state entities —
 * family history is naturally entered in a batch ("father had X, mother had
 * Y, brother has Z").
 */

interface FamilyHistoryFormProps {
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

export function FamilyHistoryForm({ patientId }: FamilyHistoryFormProps) {
  const router = useRouter();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const defaultValues: FamilyHistoryFormValues = {
    // Relation deliberately starts empty (placeholder) — the user must pick.
    relation: "",
    relationSpecific: "",
    conditionName: "",
    ageOfOnset: "",
    outcome: "",
    notes: "",
  };

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    setError,
    reset,
  } = useForm<FamilyHistoryFormValues>({
    resolver: zodResolver(familyHistoryFormSchema),
    defaultValues,
    mode: "onSubmit",
  });

  const formKeys = new Set<string>(Object.keys(defaultValues));

  // Returns true on 201, false on any error (banner/setError already applied).
  const postEntry = async (
    values: FamilyHistoryFormValues,
  ): Promise<boolean> => {
    setBannerError(null);

    // JSON.stringify drops `undefined`, so coerced-empty optionals get omitted
    // from the wire body. ageOfOnset crosses the wire as a number (the form
    // field is a string from the native input).
    const age = values.ageOfOnset?.trim();
    const body = {
      relation: values.relation,
      relationSpecific: values.relationSpecific?.trim() || undefined,
      conditionName: values.conditionName,
      ageOfOnset: age ? Number(age) : undefined,
      outcome: values.outcome?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
    };

    const res = await fetch("/api/family-history", {
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
          setError(k as keyof FamilyHistoryFormValues, { message: msgs[0] });
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
    if (!(await postEntry(values))) return;
    router.push(`/patient/${patientId}/family-history`);
    router.refresh();
  });

  const onSubmitAddAnother = handleSubmit(async (values) => {
    if (!(await postEntry(values))) return;
    reset(defaultValues);
  });

  const handleCancel = () => {
    if (isDirty) {
      setCancelOpen(true);
    } else {
      router.push(`/patient/${patientId}/family-history`);
    }
  };

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold leading-tight">
            <span className="border-b-2 border-destructive pb-1">
              Add family history
            </span>
          </h1>
          <p className="mt-4 max-w-prose text-sm text-muted-foreground">
            Direct entry — for AI-assisted entry, describe the family history
            in chat.
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
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="relation">
              Relation
              <RequiredStar />
            </FieldLabel>
            <Controller
              control={control}
              name="relation"
              render={({ field }) => (
                <Select
                  value={field.value || null}
                  onValueChange={(next) => field.onChange(next ?? "")}
                  items={RELATION_OPTIONS}
                >
                  <SelectTrigger
                    id="relation"
                    className="w-full"
                    aria-invalid={!!errors.relation}
                  >
                    <SelectValue placeholder="Select relation…" />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATION_OPTIONS.map((opt) => (
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
                errors.relation ? [{ message: errors.relation.message }] : []
              }
            />
          </Field>
          <Field>
            <FieldLabel
              className={FIELD_LABEL_CLASS}
              htmlFor="relationSpecific"
            >
              Relation specific
            </FieldLabel>
            <Input
              id="relationSpecific"
              autoComplete="off"
              placeholder="Father, older brother, paternal grandfather…"
              aria-invalid={!!errors.relationSpecific}
              {...register("relationSpecific")}
            />
            <FieldError
              errors={
                errors.relationSpecific
                  ? [{ message: errors.relationSpecific.message }]
                  : []
              }
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="conditionName">
              Condition
              <RequiredStar />
            </FieldLabel>
            <Input
              id="conditionName"
              autoFocus
              autoComplete="off"
              placeholder="Type 2 diabetes, heart attack, breast cancer…"
              aria-invalid={!!errors.conditionName}
              {...register("conditionName")}
            />
            <FieldError
              errors={
                errors.conditionName
                  ? [{ message: errors.conditionName.message }]
                  : []
              }
            />
          </Field>
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="ageOfOnset">
              Age of onset
            </FieldLabel>
            <Input
              id="ageOfOnset"
              type="number"
              inputMode="numeric"
              min={0}
              max={130}
              autoComplete="off"
              placeholder="65"
              aria-invalid={!!errors.ageOfOnset}
              {...register("ageOfOnset")}
            />
            <FieldError
              errors={
                errors.ageOfOnset
                  ? [{ message: errors.ageOfOnset.message }]
                  : []
              }
            />
          </Field>
        </div>

        <Field>
          <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="outcome">
            Outcome
          </FieldLabel>
          <Input
            id="outcome"
            autoComplete="off"
            placeholder="Passed at 78 from MI; alive, managed with medication…"
            aria-invalid={!!errors.outcome}
            {...register("outcome")}
          />
          <FieldError
            errors={errors.outcome ? [{ message: errors.outcome.message }] : []}
          />
        </Field>

        <Field>
          <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="notes">
            Notes
          </FieldLabel>
          <Textarea
            id="notes"
            rows={4}
            placeholder="Family context a doctor might ask about — how it was discovered, how it progressed."
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
              If you cancel now, the family history entry won&apos;t be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                router.push(`/patient/${patientId}/family-history`);
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
