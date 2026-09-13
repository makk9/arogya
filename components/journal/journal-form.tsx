"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { MOOD_OPTIONS, NOT_SET } from "@/components/journal/journal-options";
import { todayLocal } from "@/lib/datetime";
import {
  journalFormSchema,
  type JournalFormValues,
} from "@/lib/schemas/forms/journal";

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
 * Client form for `Log journal entry` per design.md 6.12:1862 — Title (optional)
 * · Date · Content (markdown, the main field) · Mood (added beyond the draft,
 * see lib/schemas/forms/journal.ts). Clones the Log Report form shell. No linked
 * entities here — §6.12 marks those "AI suggests on save" (Phase E).
 *
 * Voice: "written by you" — this is the user's own writing, so the framing is
 * personal, not clinical.
 */

interface JournalFormProps {
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

export function JournalForm({ patientId }: JournalFormProps) {
  const router = useRouter();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const moodItems = [
    { value: NOT_SET, label: "—" },
    ...MOOD_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];

  const defaultValues: JournalFormValues = {
    title: "",
    entryDate: todayLocal(),
    content: "",
    mood: "",
  };

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    setError,
    reset,
  } = useForm<JournalFormValues>({
    resolver: zodResolver(journalFormSchema),
    defaultValues,
    mode: "onSubmit",
  });

  const formKeys = new Set<string>(Object.keys(defaultValues));

  // Returns true on 201, false on any error (banner/setError already applied).
  const postEntry = async (values: JournalFormValues): Promise<boolean> => {
    setBannerError(null);

    const body = {
      title: values.title?.trim() || undefined,
      entryDate: values.entryDate,
      content: values.content.trim(),
      mood: values.mood || undefined,
    };

    const res = await fetch("/api/journal", {
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
          setError(k as keyof JournalFormValues, { message: msgs[0] });
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
    router.push(`/patient/${patientId}/journal`);
    router.refresh();
  });

  const onSubmitAddAnother = handleSubmit(async (values) => {
    if (!(await postEntry(values))) return;
    reset(defaultValues);
    // Stay on the form, but refresh the server tree so the rail counts update.
    router.refresh();
  });

  const handleCancel = () => {
    if (isDirty) {
      setCancelOpen(true);
    } else {
      router.push(`/patient/${patientId}/journal`);
    }
  };

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold leading-tight">
            <span className="border-b-2 border-destructive pb-1">New entry</span>
          </h1>
          <p className="mt-4 max-w-prose text-sm text-muted-foreground">
            Your own notes — observations, questions, how things are going. Markdown supported.
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
            <LabelHelper text="optional" />
          </FieldLabel>
          <Input
            id="title"
            autoComplete="off"
            placeholder="A headline — or leave blank"
            aria-invalid={!!errors.title}
            {...register("title")}
          />
          <FieldError
            errors={errors.title ? [{ message: errors.title.message }] : []}
          />
        </Field>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="entryDate">
              Date
              <RequiredStar />
              <LabelHelper text="defaults to today" />
            </FieldLabel>
            <Input
              id="entryDate"
              type="date"
              aria-invalid={!!errors.entryDate}
              {...register("entryDate")}
            />
            <FieldError
              errors={
                errors.entryDate ? [{ message: errors.entryDate.message }] : []
              }
            />
          </Field>
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="mood">
              Mood
            </FieldLabel>
            <Controller
              control={control}
              name="mood"
              render={({ field }) => (
                <Select
                  value={field.value || NOT_SET}
                  onValueChange={(next) =>
                    field.onChange(next === NOT_SET || !next ? "" : next)
                  }
                  items={moodItems}
                >
                  <SelectTrigger id="mood" className="w-full">
                    <SelectValue placeholder="How you're feeling…" />
                  </SelectTrigger>
                  <SelectContent>
                    {moodItems.map((opt) => (
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
            Entry
            <RequiredStar />
          </FieldLabel>
          <Textarea
            id="content"
            rows={12}
            placeholder="Write whatever's on your mind — what you noticed, what you're worried about, what the doctor said."
            aria-invalid={!!errors.content}
            {...register("content")}
          />
          <FieldError
            errors={errors.content ? [{ message: errors.content.message }] : []}
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
              If you cancel now, this entry won&apos;t be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                router.push(`/patient/${patientId}/journal`);
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
