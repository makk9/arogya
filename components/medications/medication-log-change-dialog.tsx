"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

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
import {
  medicationChangeFormSchema,
  type MedicationChangeFormValues,
} from "@/lib/schemas/forms/medication";
import { formatAbsoluteDate } from "@/lib/datetime";
import { displayDoctorName } from "@/lib/doctor-display";

/*
 * `+ Log a change` dialog per design.md 6.5:1383. Writes a row to
 * medication_changes via POST /api/medications/[id]/changes and updates the
 * paired current_* field on the parent medication in the same transaction.
 *
 * Mirrors medication-discontinue-dialog.tsx structurally — RHF + Zod inside
 * AlertDialog, banner errors, 409 stale-state branch, single submit. Differs
 * in that the form has a field selector that morphs the newValue input shape
 * (text / single-option select for status / doctor select for prescribing).
 *
 * Status field option is disabled when current.status !== "active" — the only
 * supported v1 transition through this endpoint is active → paused (paused →
 * active is v1.5; active → discontinued has its own route).
 */

const FIELD_LABEL_CLASS =
  "font-mono text-xs uppercase tracking-wide text-foreground";

export interface DoctorOption {
  id: string;
  name: string;
  specialty: string;
}

export interface VisitOption {
  id: string;
  visitDate: string; // YYYY-MM-DD
  doctorName: string;
}

interface Props {
  medicationId: string;
  medicationName: string;
  doctors: ReadonlyArray<DoctorOption>;
  visits: ReadonlyArray<VisitOption>;
  currentStatus: "active" | "paused" | "discontinued";
  currentPrescribingDoctorId: string | null;
  todayInPatientTz: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DialogState =
  | { kind: "normal" }
  | { kind: "stale-discontinued"; at: string | null }
  | { kind: "stale-status"; currentStatus: string };

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: {
      fieldErrors?: Record<string, string[]>;
      formErrors?: string[];
      currentStatus?: string;
      discontinuedOn?: string | null;
    };
  };
}

const FIELD_OPTIONS = [
  { value: "dose" as const, label: "Dose" },
  { value: "frequency" as const, label: "Frequency" },
  { value: "status" as const, label: "Status" },
  { value: "prescribing_doctor" as const, label: "Prescribing doctor" },
];

export function MedicationLogChangeDialog({
  medicationId,
  medicationName,
  doctors,
  visits,
  currentStatus,
  currentPrescribingDoctorId,
  todayInPatientTz,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [state, setState] = useState<DialogState>({ kind: "normal" });

  const defaultValues: MedicationChangeFormValues = {
    field: "dose",
    newValue: "",
    reason: "",
    changedAt: todayInPatientTz,
    linkedVisitId: "",
  };

  const {
    register,
    control,
    handleSubmit,
    setValue,
    clearErrors,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<MedicationChangeFormValues>({
    resolver: zodResolver(medicationChangeFormSchema),
    defaultValues,
    mode: "onSubmit",
  });

  // Local mirror of the field selector value so we don't call RHF's `watch`
  // (react-compiler flags it as not memoizable). The Controller's onChange
  // updates both RHF state and this mirror; the conditional render below
  // reads the mirror.
  const [activeField, setActiveField] =
    useState<MedicationChangeFormValues["field"]>("dose");

  const closeAndReset = () => {
    onOpenChange(false);
    reset(defaultValues);
    setActiveField("dose");
    setBannerError(null);
    setState({ kind: "normal" });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) closeAndReset();
    else onOpenChange(true);
  };

  const handleOkAfterStale = () => {
    closeAndReset();
    router.refresh();
  };

  const formKeys: ReadonlyArray<keyof MedicationChangeFormValues> = [
    "field",
    "newValue",
    "reason",
    "changedAt",
    "linkedVisitId",
  ];

  const onSubmit = handleSubmit(async (values) => {
    setBannerError(null);

    const body = {
      field: values.field,
      newValue: values.newValue,
      reason: values.reason?.trim() || undefined,
      changedAt: values.changedAt?.trim() || undefined,
      linkedVisitId: values.linkedVisitId?.trim() || undefined,
    };

    let res: Response;
    try {
      res = await fetch(`/api/medications/${medicationId}/changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      setBannerError("Couldn't reach the server. Try again.");
      return;
    }

    if (res.ok) {
      closeAndReset();
      router.refresh();
      return;
    }

    const parsed = (await res.json().catch(() => ({}))) as ApiErrorBody;
    const errBody = parsed.error;

    if (errBody?.code === "invalid_state_transition") {
      if (errBody.details?.currentStatus === "discontinued") {
        setState({
          kind: "stale-discontinued",
          at: errBody.details?.discontinuedOn ?? null,
        });
      } else {
        setState({
          kind: "stale-status",
          currentStatus: errBody.details?.currentStatus ?? "unknown",
        });
      }
      return;
    }

    if (errBody?.code === "validation_failed" && errBody.details) {
      const unknown: string[] = [];
      for (const [k, msgs] of Object.entries(errBody.details.fieldErrors ?? {})) {
        if (!msgs[0]) continue;
        if ((formKeys as ReadonlyArray<string>).includes(k)) {
          setError(k as keyof MedicationChangeFormValues, { message: msgs[0] });
        } else {
          unknown.push(`${k}: ${msgs[0]}`);
        }
      }
      const formErrs = errBody.details.formErrors ?? [];
      const banner = [...formErrs, ...unknown];
      if (banner.length) setBannerError(banner.join("; "));
      return;
    }

    setBannerError(errBody?.message ?? "Something went wrong. Try again.");
  });

  const statusOptionDisabled = currentStatus !== "active";
  const availableDoctors = doctors.filter(
    (d) => d.id !== currentPrescribingDoctorId,
  );

  // `items` maps for the Selects below — Base UI's <SelectValue> renders the
  // raw value (a uuid, for doctors/visits) on the trigger unless the root gets
  // the value→label mapping. See decisions.md 2026-06-02 (Base UI Select).
  const doctorItems = availableDoctors.map((d) => ({
    value: d.id,
    label: `${displayDoctorName(d.name)} · ${d.specialty}`,
  }));
  const visitItems = [
    { value: "__none", label: "None" },
    ...visits.map((v) => ({
      value: v.id,
      label: `${displayDoctorName(v.doctorName)} · ${formatAbsoluteDate(v.visitDate)}`,
    })),
  ];

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {state.kind === "stale-discontinued"
              ? "Already discontinued"
              : state.kind === "stale-status"
                ? "Status changed elsewhere"
                : `Log a change for ${medicationName}`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {state.kind === "stale-discontinued"
              ? state.at
                ? `This medication was discontinued on ${state.at}.`
                : `This medication is already discontinued.`
              : state.kind === "stale-status"
                ? `Current status is "${state.currentStatus}". Refresh to see the latest state.`
                : `Records a change in this medication's history.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {state.kind === "normal" ? (
          <>
            {bannerError ? (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {bannerError}
              </div>
            ) : null}

            <form
              id="log-change-form"
              noValidate
              onSubmit={onSubmit}
              className="flex flex-col gap-4"
            >
              <Field>
                <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="field">
                  What changed
                </FieldLabel>
                <Controller
                  control={control}
                  name="field"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      items={FIELD_OPTIONS}
                      onValueChange={(next) => {
                        if (!next) return;
                        const nextField =
                          next as MedicationChangeFormValues["field"];
                        field.onChange(nextField);
                        setActiveField(nextField);
                        // Reset newValue + clear stale errors on field switch.
                        // Pre-populate "paused" for the status branch.
                        setValue(
                          "newValue",
                          nextField === "status" ? "paused" : "",
                        );
                        clearErrors("newValue");
                      }}
                    >
                      <SelectTrigger id="field" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_OPTIONS.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            disabled={
                              opt.value === "status" && statusOptionDisabled
                            }
                          >
                            {opt.label}
                            {opt.value === "status" && statusOptionDisabled
                              ? ` (already ${currentStatus})`
                              : null}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError
                  errors={
                    errors.field ? [{ message: errors.field.message }] : []
                  }
                />
              </Field>

              <Field>
                <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="newValue">
                  New value
                </FieldLabel>
                {activeField === "dose" || activeField === "frequency" ? (
                  <Input
                    id="newValue"
                    placeholder={
                      activeField === "dose"
                        ? "e.g. 20 mg"
                        : "e.g. twice daily"
                    }
                    autoComplete="off"
                    aria-invalid={!!errors.newValue}
                    {...register("newValue")}
                  />
                ) : activeField === "status" ? (
                  <>
                    <Controller
                      control={control}
                      name="newValue"
                      render={({ field }) => (
                        <Select
                          value={field.value || "paused"}
                          items={[{ value: "paused", label: "Paused" }]}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger id="newValue" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="paused">Paused</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use Discontinue from the … menu for active → discontinued.
                    </p>
                  </>
                ) : (
                  <Controller
                    control={control}
                    name="newValue"
                    render={({ field }) => (
                      <Select
                        value={field.value || null}
                        items={doctorItems}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id="newValue" className="w-full">
                          <SelectValue placeholder="Select doctor…" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableDoctors.length === 0 ? (
                            <SelectItem value="__none" disabled>
                              No other doctors on file
                            </SelectItem>
                          ) : (
                            availableDoctors.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {displayDoctorName(d.name)} · {d.specialty}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
                <FieldError
                  errors={
                    errors.newValue
                      ? [{ message: errors.newValue.message }]
                      : []
                  }
                />
              </Field>

              <Field>
                <FieldLabel className={FIELD_LABEL_CLASS} htmlFor="reason">
                  Reason
                </FieldLabel>
                <Textarea
                  id="reason"
                  rows={2}
                  placeholder="e.g. raised after labs improved"
                  aria-invalid={!!errors.reason}
                  {...register("reason")}
                />
                <FieldError
                  errors={
                    errors.reason ? [{ message: errors.reason.message }] : []
                  }
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel
                    className={FIELD_LABEL_CLASS}
                    htmlFor="changedAt"
                  >
                    Changed on
                  </FieldLabel>
                  <Input
                    id="changedAt"
                    type="date"
                    aria-invalid={!!errors.changedAt}
                    {...register("changedAt")}
                  />
                  <FieldError
                    errors={
                      errors.changedAt
                        ? [{ message: errors.changedAt.message }]
                        : []
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel
                    className={FIELD_LABEL_CLASS}
                    htmlFor="linkedVisitId"
                  >
                    Linked visit
                  </FieldLabel>
                  <Controller
                    control={control}
                    name="linkedVisitId"
                    render={({ field }) => (
                      <Select
                        value={field.value || "__none"}
                        items={visitItems}
                        onValueChange={(v) =>
                          field.onChange(v === "__none" ? "" : v)
                        }
                      >
                        <SelectTrigger id="linkedVisitId" className="w-full">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">None</SelectItem>
                          {visits.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {displayDoctorName(v.doctorName)} ·{" "}
                              {formatAbsoluteDate(v.visitDate)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError
                    errors={
                      errors.linkedVisitId
                        ? [{ message: errors.linkedVisitId.message }]
                        : []
                    }
                  />
                </Field>
              </div>
            </form>
          </>
        ) : null}

        <AlertDialogFooter>
          {state.kind === "normal" ? (
            <>
              <AlertDialogCancel disabled={isSubmitting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                type="submit"
                form="log-change-form"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving…" : "Save"}
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogAction onClick={handleOkAfterStale}>
              OK
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
