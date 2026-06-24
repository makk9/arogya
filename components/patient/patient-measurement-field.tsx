"use client";

import { useState } from "react";

import { useMaybePatientEdit } from "@/components/patient/patient-edit-context";
import { useInlineCommit } from "@/components/patient/use-inline-commit";
import { Input } from "@/components/ui/input";
import {
  formatHeight,
  formatWeight,
  heightEditValue,
  heightPlaceholder,
  parseHeightToCm,
  parseWeightToKg,
  weightEditValue,
  weightPlaceholder,
  type UnitSystem,
} from "@/lib/units";

/*
 * Height / weight editor for the patient profile. Mirrors PatientInlineField's
 * useState + onBlur commit, but unit-aware: it shows the value in the patient's
 * country-derived units (design.md 6.10:1678 + lib/units.ts) and converts the
 * typed value back to canonical metric before the PATCH, since the schema
 * stores cm / kg. The API contract stays pure metric — conversion lives only
 * at this input edge.
 *
 * The displayed value in edit mode is the user's typed draft (in their units),
 * seeded from the metric value converted for display. On a clean (non-edited)
 * blur nothing commits; clearing the field PATCHes null.
 */

interface Props {
  kind: "height" | "weight";
  // Canonical metric value as stored (cm or kg), or null.
  valueMetric: string | null;
  system: UnitSystem;
  ariaLabel: string;
}

export function PatientMeasurementField({
  kind,
  valueMetric,
  system,
  ariaLabel,
}: Props) {
  const editing = useMaybePatientEdit()?.editing ?? false;
  const { pending, error, setError, commit } = useInlineCommit("/api/patient");

  const fieldKey = kind === "height" ? "heightCm" : "currentWeightKg";
  const display =
    kind === "height"
      ? formatHeight(valueMetric, system)
      : formatWeight(valueMetric, system);
  // Seed the edit draft with the bare, unit-word-free value so a blur can
  // re-parse it cleanly ("172", "5 ft 8 in", "154") — never "172 cm".
  const seed =
    kind === "height"
      ? heightEditValue(valueMetric, system)
      : weightEditValue(valueMetric, system);

  const [draft, setDraft] = useState<string>(seed);
  const [prevSeed, setPrevSeed] = useState<string>(seed);
  if (seed !== prevSeed) {
    setPrevSeed(seed);
    setDraft(seed);
    setError(null);
  }

  if (!editing) {
    return (
      <span className="text-sm">
        {display ?? <span className="text-muted-foreground">—</span>}
      </span>
    );
  }

  const handleCommit = () => {
    const next = draft.trim();
    if (next === seed.trim()) return; // no-op

    if (next === "") {
      void commit(fieldKey, null); // clearing
      return;
    }
    const parsed =
      kind === "height"
        ? parseHeightToCm(next, system)
        : parseWeightToKg(next, system);
    if (parsed === null) {
      setError(
        system === "metric"
          ? `Enter a number${kind === "height" ? " of cm" : " of kg"}.`
          : `Couldn't read that ${kind}. Try ${kind === "height" ? "5 ft 8 in" : "154 lb"}.`,
      );
      return;
    }
    void commit(fieldKey, parsed);
  };

  const placeholder =
    kind === "height" ? heightPlaceholder(system) : weightPlaceholder(system);

  return (
    <div className="flex flex-col gap-1">
      <Input
        type="text"
        inputMode={system === "metric" ? "decimal" : "text"}
        value={draft}
        aria-label={ariaLabel}
        placeholder={placeholder}
        autoComplete="off"
        disabled={pending}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleCommit}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
