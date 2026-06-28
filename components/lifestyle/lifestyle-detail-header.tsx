"use client";

import { useMaybeLifestyleEdit } from "@/components/lifestyle/lifestyle-edit-context";
import { Breadcrumb } from "@/components/breadcrumb";
import { Button } from "@/components/ui/button";
import { formatRelativeAndAbsolute } from "@/lib/datetime";

interface Props {
  patientId: string;
  /** Null when no profile row exists yet (lazily created on first write). */
  updatedAt: Date | null;
}

/*
 * Detail header per design.md §6.5 page shell, singleton variation: the H1 is
 * the fixed "Lifestyle" (there's no entity name to edit, so edit mode doesn't
 * swap the title for an input), no status pill (no status axis), and NO `…`
 * menu — the menu exists for state transitions and Delete (§6.5:1384), and a
 * singleton profile has neither (no delete story; decisions.md 2026-06-10).
 * Subtitle is the §6.10:1686 "last updated [date]" line.
 */
export function LifestyleDetailHeader({ patientId, updatedAt }: Props) {
  const editCtx = useMaybeLifestyleEdit();
  const editing = editCtx?.editing ?? false;
  const setEditing = editCtx?.setEditing ?? (() => {});

  return (
    <>
      <Breadcrumb patientId={patientId} trail={[{ label: "lifestyle" }]} />

      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold leading-tight">
          <span className="border-b-2 border-destructive pb-1">Lifestyle</span>
        </h1>

        <Button
          type="button"
          variant={editing ? "default" : "outline"}
          size="sm"
          onClick={() => setEditing(!editing)}
        >
          {editing ? "Done" : "Edit"}
        </Button>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        {updatedAt
          ? `last updated ${formatRelativeAndAbsolute(updatedAt)}`
          : "Nothing recorded yet — Edit any field to start."}
      </p>
    </>
  );
}
