"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { NOT_SET } from "@/components/conditions/condition-options";
import {
  BODY_AREA_OPTIONS,
  SEVERITY_OPTIONS,
} from "@/components/symptoms/symptom-options";
import {
  NEW_TYPE,
  symptomFormSchema,
  type SymptomFormValues,
} from "@/lib/schemas/forms/symptom";
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
 * Client form for `Log symptom` per §6.12:1854 — logs one SymptomEpisode and,
 * when the user picks "+ Create new", its SymptomType inline (one atomic POST to
 * /api/symptom-episodes). Clones the Log-visit form shell.
 *
 * The §6.12 "rich autocomplete + Create new" is rendered as a plain Select of
 * existing types plus a `+ Create new symptom` row that reveals a name (+ body
 * area) input — the standing autocomplete carryover (same as visits' doctor
 * select). Linked vital is a single optional select of recent readings (the
 * array supports more, set later by extraction — flagged).
 */

interface TypeOption {
  id: string;
  name: string;
}
interface VitalOption {
  id: string;
  label: string;
}

interface SymptomFormProps {
  patientId: string;
  types: ReadonlyArray<TypeOption>;
  vitals: ReadonlyArray<VitalOption>;
  /**
   * When set (from a SymptomType page's "+ Log episode"), the Symptom field is
   * locked to this type — the user is logging an episode FOR it, so the chooser
   * and "+ Create new" path are removed.
   */
  lockedType?: { id: string; name: string };
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

function nowLocalDatetime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Server field → form field for error routing.
const SERVER_TO_FORM: Record<string, keyof SymptomFormValues> = {
  symptomTypeId: "typeSelection",
  newType: "newTypeName",
  startedAt: "startedAtLocal",
  endedAt: "startedAtLocal",
  durationMinutes: "durationMinutes",
  severity: "severity",
  description: "description",
  triggers: "triggers",
  relief: "relief",
  linkedVitalIds: "linkedVitalId",
  notes: "notes",
};

// Maps an "Edit manually instead" extraction draft (§6.11). The agent extracts
// symptom (name)/started_at/severity/notes; the name creates a new type. Only
// applied in the open "Log symptom" flow — a locked entry keeps its type.
const SYMPTOM_SEVERITIES = ["mild", "moderate", "severe"] as const;

function draftToSymptomValues(
  d: Record<string, unknown> | null,
): Partial<SymptomFormValues> {
  if (!d) return {};
  const out: Partial<SymptomFormValues> = {};
  const name = draftString(d.symptom);
  if (name) {
    out.typeSelection = NEW_TYPE;
    out.newTypeName = name;
  }
  const severity = draftEnum(d.severity, SYMPTOM_SEVERITIES);
  if (severity) out.severity = severity;
  const notes = draftString(d.notes);
  if (notes) out.notes = notes;
  return out;
}

export function SymptomForm({
  patientId,
  types,
  vitals,
  lockedType,
}: SymptomFormProps) {
  const router = useRouter();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const locked = lockedType != null;
  // Only consume a draft in the open "Log symptom" flow — a locked entry (from a
  // symptom's page) keeps that type, so it must not read/clear the draft.
  const [draft] = useState(() =>
    lockedType ? null : takeExtractionDraft("symptom_episode"),
  );
  // Locked → return to that symptom's page (the user came from there and the new
  // episode shows up in its stream). Otherwise the timeline.
  const returnHref = lockedType
    ? `/patient/${patientId}/symptoms/types/${lockedType.id}`
    : `/patient/${patientId}/symptoms`;

  const typeItems = [
    { value: NEW_TYPE, label: "+ Create new symptom" },
    ...types.map((t) => ({ value: t.id, label: t.name })),
  ];
  const bodyAreaItems = [
    { value: NOT_SET, label: "—" },
    ...BODY_AREA_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];
  const severityItems = [
    { value: NOT_SET, label: "—" },
    ...SEVERITY_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];
  const vitalItems = [
    { value: NOT_SET, label: "— none" },
    ...vitals.map((v) => ({ value: v.id, label: v.label })),
  ];

  const defaultValues: SymptomFormValues = {
    // Open-ended "Log symptom" defaults to "+ Create new" — pre-selecting the
    // most-recent existing symptom risks logging an episode under the wrong one
    // by accident; picking an existing symptom should be deliberate. (The locked
    // entry from a symptom's page keeps that type.)
    typeSelection: lockedType ? lockedType.id : NEW_TYPE,
    newTypeName: "",
    newTypeBodyArea: "",
    startedAtLocal: nowLocalDatetime(),
    durationMinutes: "",
    severity: "",
    description: "",
    triggers: "",
    relief: "",
    linkedVitalId: "",
    notes: "",
    ...draftToSymptomValues(draft),
  };

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    setError,
    reset,
  } = useForm<SymptomFormValues>({
    resolver: zodResolver(symptomFormSchema),
    defaultValues,
    mode: "onSubmit",
  });

  // useWatch (not the useForm `watch` fn) — memoization-safe under React Compiler.
  const typeSelection = useWatch({ control, name: "typeSelection" });
  const hasTypes = types.length > 0;
  // With no existing types the only path is a new one, so the type Select is
  // hidden and the name/body-area inputs stand in for it directly (a single-
  // option "+ Create new" dropdown would be noise). Otherwise "create new" is
  // the explicit NEW_TYPE pick.
  const creatingNew = !locked && (!hasTypes || typeSelection === NEW_TYPE);

  const postEpisode = async (values: SymptomFormValues): Promise<boolean> => {
    setBannerError(null);

    const typePart = creatingNew
      ? {
          newType: {
            name: values.newTypeName.trim(),
            ...(values.newTypeBodyArea
              ? { bodyArea: values.newTypeBodyArea }
              : {}),
          },
        }
      : { symptomTypeId: values.typeSelection };

    const body = {
      ...typePart,
      startedAt: new Date(values.startedAtLocal).toISOString(),
      ...(values.durationMinutes.trim()
        ? { durationMinutes: Number(values.durationMinutes.trim()) }
        : {}),
      ...(values.severity ? { severity: values.severity } : {}),
      ...(values.description.trim() ? { description: values.description.trim() } : {}),
      ...(values.triggers.trim() ? { triggers: values.triggers.trim() } : {}),
      ...(values.relief.trim() ? { relief: values.relief.trim() } : {}),
      ...(values.linkedVitalId ? { linkedVitalIds: [values.linkedVitalId] } : {}),
      ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
    };

    const res = await fetch("/api/symptom-episodes", {
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
        const formKey = SERVER_TO_FORM[k];
        if (formKey) setError(formKey, { message: msgs[0] });
        else unknownFieldMessages.push(`${k}: ${msgs[0]}`);
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
    if (!(await postEpisode(values))) return;
    router.push(returnHref);
    router.refresh();
  });

  const onSubmitAddAnother = handleSubmit(async (values) => {
    if (!(await postEpisode(values))) return;
    reset({ ...defaultValues, startedAtLocal: nowLocalDatetime() });
  });

  const handleCancel = () => {
    if (isDirty) setCancelOpen(true);
    else router.push(returnHref);
  };

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold leading-tight">
            <span className="border-b-2 border-destructive pb-1">Log symptom</span>
          </h1>
          <p className="mt-4 max-w-prose text-sm text-muted-foreground">
            One episode of a symptom. Repeat episodes group under the same
            symptom so patterns over time show up. For AI-assisted entry,
            describe it in chat.
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
        {lockedType ? (
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="symptomLocked">
              Symptom
              <RequiredStar />
            </FieldLabel>
            <div
              id="symptomLocked"
              className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm font-medium text-foreground"
            >
              {lockedType.name}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Logging an episode for this symptom.
            </p>
          </Field>
        ) : hasTypes ? (
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="typeSelection">
              Symptom
              <RequiredStar />
            </FieldLabel>
            <Controller
              control={control}
              name="typeSelection"
              render={({ field }) => (
                <Select
                  value={field.value || null}
                  onValueChange={(next) => field.onChange(next ?? "")}
                  items={typeItems}
                >
                  <SelectTrigger
                    id="typeSelection"
                    className="w-full"
                    aria-invalid={!!errors.typeSelection}
                  >
                    <SelectValue placeholder="Pick a symptom…" />
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
            <FieldError
              errors={
                errors.typeSelection
                  ? [{ message: errors.typeSelection.message }]
                  : []
              }
            />
          </Field>
        ) : null}

        {creatingNew ? (
          <div
            className={
              hasTypes
                ? "grid grid-cols-1 gap-5 rounded-lg border border-dashed border-border p-4 md:grid-cols-2"
                : "grid grid-cols-1 gap-5 md:grid-cols-2"
            }
          >
            <Field>
              <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="newTypeName">
                {hasTypes ? "New symptom name" : "Symptom"}
                <RequiredStar />
              </FieldLabel>
              <Input
                id="newTypeName"
                autoComplete="off"
                placeholder="Dizziness, ankle swelling, lower back pain…"
                aria-invalid={!!errors.newTypeName}
                {...register("newTypeName")}
              />
              <FieldError
                errors={
                  errors.newTypeName
                    ? [{ message: errors.newTypeName.message }]
                    : []
                }
              />
            </Field>
            <Field>
              <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="newTypeBodyArea">
                Body area
              </FieldLabel>
              <Controller
                control={control}
                name="newTypeBodyArea"
                render={({ field }) => (
                  <Select
                    value={field.value || NOT_SET}
                    onValueChange={(next) =>
                      field.onChange(next === NOT_SET || !next ? "" : next)
                    }
                    items={bodyAreaItems}
                  >
                    <SelectTrigger id="newTypeBodyArea" className="w-full">
                      <SelectValue placeholder="Where…" />
                    </SelectTrigger>
                    <SelectContent>
                      {bodyAreaItems.map((opt) => (
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
        ) : null}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="startedAtLocal">
              Started at
              <RequiredStar />
              <LabelHelper text="defaults to now" />
            </FieldLabel>
            <Input
              id="startedAtLocal"
              type="datetime-local"
              aria-invalid={!!errors.startedAtLocal}
              {...register("startedAtLocal")}
            />
            <FieldError
              errors={
                errors.startedAtLocal
                  ? [{ message: errors.startedAtLocal.message }]
                  : []
              }
            />
          </Field>
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="durationMinutes">
              Duration
              <LabelHelper text="minutes" />
            </FieldLabel>
            <Input
              id="durationMinutes"
              inputMode="numeric"
              autoComplete="off"
              placeholder="30"
              aria-invalid={!!errors.durationMinutes}
              {...register("durationMinutes")}
            />
            <FieldError
              errors={
                errors.durationMinutes
                  ? [{ message: errors.durationMinutes.message }]
                  : []
              }
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
                  value={field.value || NOT_SET}
                  onValueChange={(next) =>
                    field.onChange(next === NOT_SET || !next ? "" : next)
                  }
                  items={severityItems}
                >
                  <SelectTrigger id="severity" className="w-full">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {severityItems.map((opt) => (
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
          <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="description">
            Description
          </FieldLabel>
          <Textarea
            id="description"
            rows={4}
            placeholder="What the episode felt like."
            aria-invalid={!!errors.description}
            {...register("description")}
          />
          <FieldError
            errors={
              errors.description ? [{ message: errors.description.message }] : []
            }
          />
        </Field>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="triggers">
              Triggers
            </FieldLabel>
            <Input
              id="triggers"
              autoComplete="off"
              placeholder="After getting up too fast, skipped breakfast…"
              aria-invalid={!!errors.triggers}
              {...register("triggers")}
            />
          </Field>
          <Field>
            <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="relief">
              What helped
            </FieldLabel>
            <Input
              id="relief"
              autoComplete="off"
              placeholder="Sat down for 5 minutes, took Pudin Hara…"
              aria-invalid={!!errors.relief}
              {...register("relief")}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="linkedVitalId">
            Linked reading
            <LabelHelper text="a vital taken during this episode" />
          </FieldLabel>
          <Controller
            control={control}
            name="linkedVitalId"
            render={({ field }) => (
              <Select
                value={field.value || NOT_SET}
                onValueChange={(next) =>
                  field.onChange(next === NOT_SET || !next ? "" : next)
                }
                items={vitalItems}
              >
                <SelectTrigger id="linkedVitalId" className="w-full">
                  <SelectValue placeholder="— none" />
                </SelectTrigger>
                <SelectContent>
                  {vitalItems.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {vitals.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              No readings logged yet. Log a reading first to link one here.
            </p>
          ) : null}
        </Field>

        <Field>
          <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="notes">
            Notes
          </FieldLabel>
          <Textarea
            id="notes"
            rows={3}
            placeholder="Anything else worth remembering about this episode."
            aria-invalid={!!errors.notes}
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
              If you cancel now, the symptom won&apos;t be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                router.push(returnHref);
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
