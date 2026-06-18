import type { journalMood } from "@/db/schema";

/*
 * Shared option list for the journal Mood Select (form, inline edit) + its label
 * map for read surfaces. Single source for enum → display-label pairing, same
 * pattern as visit-options.ts. Type-only import from @/db/schema — no runtime DB
 * edge in the client bundle.
 */

type MoodValue = (typeof journalMood.enumValues)[number];

export const MOOD_OPTIONS: ReadonlyArray<{ value: MoodValue; label: string }> = [
  { value: "concerned", label: "Concerned" },
  { value: "neutral", label: "Neutral" },
  { value: "hopeful", label: "Hopeful" },
  { value: "frustrated", label: "Frustrated" },
  { value: "other", label: "Other" },
];

export const MOOD_LABEL: Record<string, string> = Object.fromEntries(
  MOOD_OPTIONS.map((o) => [o.value, o.label]),
);

export { NOT_SET } from "@/lib/select-sentinel";
