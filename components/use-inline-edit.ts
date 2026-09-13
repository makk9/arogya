"use client";

import { useRef, useState } from "react";

/*
 * Shared machinery for the per-vertical inline-field clones (decisions.md
 * 2026-08-13, /check follow-up). Draft/pending/error state, the
 * self-activation lifecycle, and the commit shell (no-op check, required
 * check, PATCH, error mapping) were copied identically across all ten
 * verticals; only the endpoint, the draft↔wire mapping, and the rendered
 * controls differ. The clones keep their JSX and field maps — this hook keeps
 * them from drifting on the mechanics (e.g. the Base UI close-before-change
 * race fix lives here exactly once).
 */

export type CommitOutcome = "saved" | "noop" | "error";

/** Result of mapping a draft to the PATCH body value. */
export type ToWire =
  | { value: unknown }
  | { skip: true }
  | { error: string };

/** The standard string field mapping: empty + clearable → null. */
export const stringToWire =
  (clearable: boolean) =>
  (next: string): ToWire => ({
    value: next === "" && clearable ? null : next,
  });

export interface InlineApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: {
      fieldErrors?: Record<string, string[]>;
      formErrors?: string[];
      rejectedFields?: Record<string, string>;
    };
  };
}

export interface InlineEditOptions {
  initialValue: string | null;
  /** Converts the upstream value to the editor draft (default `v ?? ""`) —
   * e.g. the episode's ISO→datetime-local conversion. Also defines the no-op
   * baseline and what Escape reverts to. */
  toDraft?: (v: string | null) => string;
  fieldKey: string;
  required: boolean;
  ariaLabel: string;
  /** True while the surface's global Edit mode is on. */
  editing: boolean;
  /** PATCH target for `{ [fieldKey]: wireValue }`. */
  endpoint: string;
  /** Maps a draft to the wire value (clearable nulls, tag arrays, parses).
   * `skip` no-ops silently; `error` shows inline without a request. */
  toWire: (next: string) => ToWire;
  /** First-shot API-error branch (e.g. lifestyle's locked-field copy);
   * return null to fall through to the per-field message. */
  mapApiError?: (body: InlineApiErrorBody) => string | null;
  /** Runs after a successful PATCH (typically router.refresh()). */
  onSaved: () => void;
}

export function useInlineEdit({
  initialValue,
  toDraft = (v) => v ?? "",
  fieldKey,
  required,
  ariaLabel,
  editing,
  endpoint,
  toWire,
  mapApiError,
  onSaved,
}: InlineEditOptions) {
  const [draft, setDraft] = useState<string>(toDraft(initialValue));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Self-activation: this one field is in its editor without global edit mode.
  const [selfActive, setSelfActive] = useState(false);
  // Ref mirror of "a commit is in flight" for the select-close handler, which
  // fires in the same tick as the value change (state would be stale).
  const commitInFlight = useRef(false);

  // Sync local draft when the upstream value changes (router.refresh after a
  // successful PATCH, or a parallel write). Adjusting state during render per
  // React's "you might not need an effect" guidance — cheaper than useEffect
  // and avoids the lint rule against setState-in-effect.
  const [prevInitial, setPrevInitial] = useState<string | null>(initialValue);
  if (initialValue !== prevInitial) {
    setPrevInitial(initialValue);
    setDraft(toDraft(initialValue));
    setError(null);
  }

  const commit = async (next: string): Promise<CommitOutcome> => {
    if (next === toDraft(initialValue)) return "noop";
    if (!next && required) {
      setError(`${ariaLabel} is required.`);
      return "error";
    }
    const wire = toWire(next);
    if ("skip" in wire) return "noop";
    if ("error" in wire) {
      setError(wire.error);
      return "error";
    }

    setError(null);
    setPending(true);
    commitInFlight.current = true;
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [fieldKey]: wire.value }),
      });
      if (res.ok) {
        onSaved();
        return "saved";
      }
      const parsed = (await res.json().catch(() => ({}))) as InlineApiErrorBody;
      const custom = mapApiError?.(parsed);
      if (custom) {
        setError(custom);
        return "error";
      }
      const fieldMsg = parsed.error?.details?.fieldErrors?.[fieldKey]?.[0];
      setError(fieldMsg ?? parsed.error?.message ?? "Couldn't save.");
      return "error";
    } catch {
      setError("Couldn't reach the server.");
      return "error";
    } finally {
      setPending(false);
      commitInFlight.current = false;
    }
  };

  // After a commit from a self-activated editor: return to display unless an
  // error needs to stay visible. Harmless in global edit mode.
  // On error, pin the field open (self-active) — Done blurs the field and
  // leaves global Edit mode BEFORE the PATCH returns, so without this the
  // editor, and the error with it, would vanish and a rejected value would
  // read as saved. Escape still reverts.
  const settle = (outcome: CommitOutcome) => {
    setSelfActive(outcome === "error");
  };

  const revertAndClose = () => {
    setDraft(toDraft(initialValue));
    setError(null);
    setSelfActive(false);
  };

  /** onBlur for text/textarea/date editors. */
  const blurCommit = () => {
    void commit(draft).then(settle);
  };

  /** onKeyDown for text-like editors; Enter is opt-out for textareas. */
  const keyDown =
    ({ enterCommits }: { enterCommits: boolean }) =>
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === "Escape") revertAndClose();
      else if (enterCommits && e.key === "Enter") e.currentTarget.blur();
    };

  /** onOpenChange for selects (which open directly on self-activation).
   * Closed without picking: back to display. A pick closes the popup too —
   * and Base UI fires the close BEFORE onValueChange — so defer one tick; by
   * then commitInFlight tells the two closes apart, and settle() owns
   * deactivation on the pick path. */
  const selectOpenChange = (open: boolean) => {
    if (!open && selfActive) {
      setTimeout(() => {
        if (!commitInFlight.current) setSelfActive(false);
      }, 0);
    }
  };

  /** Commit path for select pickers (commit-on-change, not blur). */
  const commitFromSelect = (v: string) => {
    setDraft(v);
    commitInFlight.current = true;
    void commit(v).then(settle);
  };

  return {
    draft,
    setDraft,
    pending,
    error,
    /** Editor is visible: global edit mode OR this field self-activated. */
    active: editing || selfActive,
    selfActive,
    activate: () => setSelfActive(true),
    commit,
    settle,
    revertAndClose,
    blurCommit,
    keyDown,
    selectOpenChange,
    commitFromSelect,
  };
}
