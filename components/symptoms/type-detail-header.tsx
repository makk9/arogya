"use client";

import type { ReactNode } from "react";

import {
  BODY_AREA_LABEL,
  STATUS_LABEL,
} from "@/components/symptoms/symptom-options";
import { TypeInlineField } from "@/components/symptoms/type-inline-field";
import { useMaybeTypeEdit } from "@/components/symptoms/type-edit-context";
import { Breadcrumb } from "@/components/breadcrumb";
import { Button } from "@/components/ui/button";
import type { SymptomType } from "@/db/schema";

interface Props {
  patientId: string;
  type: SymptomType;
  episodeCount: number;
  actionsSlot: ReactNode | null;
}

/*
 * SymptomType detail header — the state-detail page shell (§6.5). Title is the
 * symptom name with the status pill beside it and a body-area pill when set.
 * Edit mode swaps the name into an inline text field; status / body area edit in
 * the Current section below. Subtitle is the episode-count context.
 */
export function TypeDetailHeader({
  patientId,
  type,
  episodeCount,
  actionsSlot,
}: Props) {
  const editCtx = useMaybeTypeEdit();
  const editing = editCtx?.editing ?? false;
  const setEditing = editCtx?.setEditing ?? (() => {});

  return (
    <>
      <Breadcrumb patientId={patientId} trail={[{ label: "symptoms", href: "symptoms" }, { label: type.name }]} />

      <div className="mb-2 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <TypeInlineField
              fieldKey="name"
              value={type.name}
              variant="text"
              required
              clearable={false}
              ariaLabel="Symptom name"
              inputClassName="text-xl font-semibold"
              displayValue={null}
            />
          ) : (
            <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-heading text-2xl font-semibold leading-tight">
              <span className="border-b-2 border-destructive pb-1">
                {type.name}
              </span>
              <span className="inline-flex items-baseline rounded-full border border-border bg-muted px-2 py-0.5 text-[0.55em] font-medium uppercase tracking-wide text-muted-foreground">
                {STATUS_LABEL[type.status] ?? type.status}
              </span>
              {type.bodyArea ? (
                <span className="inline-flex items-baseline rounded-full border border-border bg-muted px-2 py-0.5 text-[0.55em] font-medium uppercase tracking-wide text-muted-foreground">
                  {BODY_AREA_LABEL[type.bodyArea] ?? type.bodyArea}
                </span>
              ) : null}
            </h1>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant={editing ? "default" : "outline"}
            size="sm"
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Done" : "Edit"}
          </Button>
          {actionsSlot}
        </div>
      </div>

      {!editing ? (
        // Frames the page as the symptom's record/overview, distinct from a
        // single episode page (which leads with the same symptom name).
        <p className="mt-2 text-sm text-muted-foreground">
          This symptom and every episode logged for it ·{" "}
          {episodeCount} {episodeCount === 1 ? "episode" : "episodes"}
        </p>
      ) : null}
    </>
  );
}
