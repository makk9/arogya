"use client";

import type { ReactNode } from "react";

import {
  CATEGORY_OPTIONS,
  STATUS_OPTIONS,
} from "@/components/conditions/condition-options";
import { ConditionInlineField } from "@/components/conditions/condition-inline-field";
import { useMaybeConditionEdit } from "@/components/conditions/condition-edit-context";
import { Button } from "@/components/ui/button";
import type { Condition } from "@/db/schema";
import { formatAbsoluteDate } from "@/lib/datetime";

interface Props {
  patientId: string;
  condition: Condition;
  // Slot for the `…` menu.
  actionsSlot: ReactNode | null;
}

/*
 * Detail header per design.md §6.5 page shell — breadcrumb, then a flex row with
 * the H1 (or an editable name input) on the left and the Edit/Done button + `…`
 * menu on the right. Clones medication-detail-header.tsx.
 *
 * Divergences from Medication: the status pill is a NEUTRAL semantic-token pill
 * (no emerald/amber color-coding — see condition-current-section note), and the
 * Edit button + menu are always available (Condition has no terminal state).
 */

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
);
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
);

export function ConditionDetailHeader({
  patientId,
  condition,
  actionsSlot,
}: Props) {
  const editCtx = useMaybeConditionEdit();
  const editing = editCtx?.editing ?? false;
  const setEditing = editCtx?.setEditing ?? (() => {});

  const subtitleParts: string[] = [];
  if (condition.category) {
    subtitleParts.push(CATEGORY_LABEL[condition.category] ?? condition.category);
  }
  if (condition.diagnosedOn) {
    subtitleParts.push(`diagnosed ${formatAbsoluteDate(condition.diagnosedOn)}`);
  }

  return (
    <>
      <nav
        aria-label="breadcrumb"
        className="mb-6 font-mono text-xs text-muted-foreground"
      >
        / patient / {patientId.slice(0, 8)}… / conditions /{" "}
        {condition.id.slice(0, 8)}…
      </nav>

      <div className="mb-2 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-col gap-3">
              <ConditionInlineField
                fieldKey="name"
                value={condition.name}
                variant="text"
                required
                clearable={false}
                ariaLabel="Name"
                displayValue={condition.name}
              />
              <span className="inline-flex w-fit items-baseline rounded-full border border-border bg-muted px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                {STATUS_LABEL[condition.status] ?? condition.status}
              </span>
            </div>
          ) : (
            <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-heading text-2xl font-semibold leading-tight">
              <span className="border-b-2 border-destructive pb-1">
                {condition.name}
              </span>
              <span className="inline-flex items-baseline rounded-full border border-border bg-muted px-2 py-0.5 text-[0.55em] font-medium uppercase tracking-wide text-muted-foreground">
                {STATUS_LABEL[condition.status] ?? condition.status}
              </span>
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

      {!editing && subtitleParts.length > 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {subtitleParts.join(" · ")}
        </p>
      ) : null}
    </>
  );
}
