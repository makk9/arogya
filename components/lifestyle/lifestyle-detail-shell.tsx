"use client";

import { useCallback, useState, type ReactNode } from "react";

import { LifestyleEditProvider } from "@/components/lifestyle/lifestyle-edit-context";
import { LifestyleLogChangeProvider } from "@/components/lifestyle/lifestyle-log-change-context";
import { LifestyleLogChangeDialog } from "@/components/lifestyle/lifestyle-log-change-dialog";
import type { LifestyleTrendFieldKey } from "@/components/lifestyle/lifestyle-options";
import type { LifestyleProfile } from "@/db/schema";

interface Props {
  /** Null when the singleton row hasn't been created yet. */
  profile: LifestyleProfile | null;
  children: ReactNode;
}

/*
 * Client wrapper around the Lifestyle page. Clones allergy-detail-shell.tsx:
 * provides the edit context (Edit/Done button lives in the header) and the
 * `+ Log a change` opener; owns the dialog so its open state survives across
 * the header, the Current section's value boxes, and the History section
 * button.
 *
 * `open(field)` preselects that field in the dialog. The dialog is keyed per
 * open so each launch mounts fresh with the right defaults — no reset
 * effects fighting react-hook-form state.
 *
 * The dialog gets the whole (nullable) profile — it needs every trend field's
 * current value for enum-option exclusion and narrative prefill.
 */
export function LifestyleDetailShell({ profile, children }: Props) {
  const [editing, setEditing] = useState(false);
  const [logChangeOpen, setLogChangeOpen] = useState(false);
  const [initialField, setInitialField] =
    useState<LifestyleTrendFieldKey | null>(null);
  const [dialogKey, setDialogKey] = useState(0);

  const openLogChange = useCallback((field?: LifestyleTrendFieldKey) => {
    setInitialField(field ?? null);
    setDialogKey((k) => k + 1);
    setLogChangeOpen(true);
  }, []);

  return (
    <>
      <LifestyleEditProvider value={{ editing, setEditing }}>
        <LifestyleLogChangeProvider value={{ open: openLogChange }}>
          {children}
        </LifestyleLogChangeProvider>
      </LifestyleEditProvider>

      <LifestyleLogChangeDialog
        key={dialogKey}
        profile={profile}
        open={logChangeOpen}
        onOpenChange={setLogChangeOpen}
        initialField={initialField}
      />
    </>
  );
}
