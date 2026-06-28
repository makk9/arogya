"use client";

import type { ReactNode } from "react";

import { RELATION_LABEL } from "@/components/family-history/family-history-options";
import { FamilyHistoryInlineField } from "@/components/family-history/family-history-inline-field";
import { useMaybeFamilyHistoryEdit } from "@/components/family-history/family-history-edit-context";
import { Breadcrumb } from "@/components/breadcrumb";
import { Button } from "@/components/ui/button";
import type { FamilyHistoryEntry } from "@/db/schema";

interface Props {
  patientId: string;
  entry: FamilyHistoryEntry;
  // Slot for the `…` menu.
  actionsSlot: ReactNode | null;
}

/*
 * Detail header per design.md §6.5 page shell. Clones allergy-detail-header.
 *
 * §6.5:1404 lists the FamilyHistory fields without naming a title — the H1 is
 * the condition name (the clinically scannable identity; "Heart attack", not
 * "Father") with the relation-type pill beside it where other entities show a
 * status pill (FamilyHistory has no status). Subtitle carries the who + onset
 * ("Father · onset age 65"). Call noted in decisions.md 2026-06-10.
 */

export function FamilyHistoryDetailHeader({
  patientId,
  entry,
  actionsSlot,
}: Props) {
  const editCtx = useMaybeFamilyHistoryEdit();
  const editing = editCtx?.editing ?? false;
  const setEditing = editCtx?.setEditing ?? (() => {});

  const relationLabel = RELATION_LABEL[entry.relation] ?? entry.relation;
  const subtitleParts: string[] = [entry.relationSpecific ?? relationLabel];
  if (entry.ageOfOnset !== null) {
    subtitleParts.push(`onset age ${entry.ageOfOnset}`);
  }

  return (
    <>
      <Breadcrumb patientId={patientId} trail={[{ label: "family-history", href: "family-history" }, { label: `${entry.id.slice(0, 8)}…` }]} />

      <div className="mb-2 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-col gap-3">
              <FamilyHistoryInlineField
                fieldKey="conditionName"
                value={entry.conditionName}
                variant="text"
                required
                clearable={false}
                ariaLabel="Condition"
                displayValue={entry.conditionName}
              />
              <span className="inline-flex w-fit items-baseline rounded-full border border-border bg-muted px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                {relationLabel}
              </span>
            </div>
          ) : (
            <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-heading text-2xl font-semibold leading-tight">
              <span className="border-b-2 border-destructive pb-1">
                {entry.conditionName}
              </span>
              <span className="inline-flex items-baseline rounded-full border border-border bg-muted px-2 py-0.5 text-[0.55em] font-medium uppercase tracking-wide text-muted-foreground">
                {relationLabel}
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
