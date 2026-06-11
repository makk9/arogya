"use client";

import type { ReactNode } from "react";

import {
  CATEGORY_OPTIONS,
  STATUS_OPTIONS,
} from "@/components/allergies/allergy-options";
import { AllergyInlineField } from "@/components/allergies/allergy-inline-field";
import { useMaybeAllergyEdit } from "@/components/allergies/allergy-edit-context";
import { Button } from "@/components/ui/button";
import type { Allergy } from "@/db/schema";
import { formatAbsoluteDate } from "@/lib/datetime";

interface Props {
  patientId: string;
  allergy: Allergy;
  // Slot for the `…` menu.
  actionsSlot: ReactNode | null;
}

/*
 * Detail header per design.md §6.5 page shell — breadcrumb, then a flex row
 * with the H1 (or an editable substance input) on the left and the Edit/Done
 * button + `…` menu on the right. Clones condition-detail-header.tsx.
 *
 * The H1 *is* the substance — §6.5:1402 lists substance among the prominent
 * Current fields, but repeating the page title inside a card is noise, so the
 * Current section keeps category + severity prominent instead (deviation noted
 * in decisions.md 2026-06-10).
 */

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
);
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
);

export function AllergyDetailHeader({ patientId, allergy, actionsSlot }: Props) {
  const editCtx = useMaybeAllergyEdit();
  const editing = editCtx?.editing ?? false;
  const setEditing = editCtx?.setEditing ?? (() => {});

  const subtitleParts: string[] = [];
  subtitleParts.push(CATEGORY_LABEL[allergy.category] ?? allergy.category);
  if (allergy.firstNoted) {
    subtitleParts.push(`first noted ${formatAbsoluteDate(allergy.firstNoted)}`);
  }

  return (
    <>
      <nav
        aria-label="breadcrumb"
        className="mb-6 font-mono text-xs text-muted-foreground"
      >
        / patient / {patientId.slice(0, 8)}… / allergies /{" "}
        {allergy.id.slice(0, 8)}…
      </nav>

      <div className="mb-2 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-col gap-3">
              <AllergyInlineField
                fieldKey="substance"
                value={allergy.substance}
                variant="text"
                required
                clearable={false}
                ariaLabel="Substance"
                displayValue={allergy.substance}
              />
              <span className="inline-flex w-fit items-baseline rounded-full border border-border bg-muted px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                {STATUS_LABEL[allergy.status] ?? allergy.status}
              </span>
            </div>
          ) : (
            <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-heading text-2xl font-semibold leading-tight">
              <span className="border-b-2 border-destructive pb-1">
                {allergy.substance}
              </span>
              <span className="inline-flex items-baseline rounded-full border border-border bg-muted px-2 py-0.5 text-[0.55em] font-medium uppercase tracking-wide text-muted-foreground">
                {STATUS_LABEL[allergy.status] ?? allergy.status}
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
