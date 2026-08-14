"use client";

import type { ReactNode } from "react";
import type { Components } from "react-markdown";

/*
 * Shared click-to-log-a-change affordances (decisions.md 2026-08-12). A
 * change-logged value is itself the entry point to the `+ Log a change`
 * dialog, preselected to that field — the user's "click the information to
 * change it" instinct routes to the change-log write path instead of
 * dead-ending. Two shapes:
 *
 *  - LogChangeCard: a prominent §6.5 card (dose, status, severity, specialty…)
 *    becomes a full-card button; a ghost "log a change →" hint fades in at the
 *    card's top-right on hover/focus.
 *  - LogChangeValue: a compact-grid value becomes a small button; a dotted
 *    underline fades in on hover/focus — signals "this value can change"
 *    without reading as a link.
 *
 * Both render inert (plain markup) when onLogChange is null — e.g. a
 * discontinued medication's shell omits the log-change provider.
 *
 * Values that are already navigation links (prescribing doctor, managing
 * doctor) are NOT wrapped — navigation wins over the log-change affordance.
 */

// Markdown rendered INSIDE a click-to-edit target would nest any link as
// <a> inside <button> — invalid HTML with a dead click. Render links as
// their text instead; the URL stays intact in the stored markdown and shows
// in the editor.
export const CLICK_TARGET_MARKDOWN_COMPONENTS: Components = {
  a: ({ children }) => <span>{children}</span>,
};

// Ghost hint, positioned against the nearest `relative` ancestor (the card).
// Shown via group-hover/group-focus — the `group` class lives on the button.
export const LOG_CHANGE_HINT_CLASS =
  "pointer-events-none absolute right-4 top-4 font-mono text-[10px] uppercase tracking-wide text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100";

export function LogChangeHint() {
  return <span className={LOG_CHANGE_HINT_CLASS}>log a change →</span>;
}

export function LogChangeCard({
  onLogChange,
  ariaLabel,
  className,
  children,
}: {
  /** Null renders the card inert (no button, no hint). */
  onLogChange: (() => void) | null;
  ariaLabel: string;
  /** The card chrome (border, bg, padding) — kept caller-side so the inert
   * fallback renders identically. */
  className: string;
  children: ReactNode;
}) {
  if (!onLogChange) {
    return <div className={className}>{children}</div>;
  }
  return (
    <button
      type="button"
      onClick={onLogChange}
      aria-label={ariaLabel}
      className={`group relative w-full text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 ${className}`}
    >
      {children}
      <LogChangeHint />
    </button>
  );
}

// One hover language for every clickable value — dotted underline — whether
// the click opens the log-change dialog or an in-place editor. The user's
// rule is just "click a value to change it"; the routing difference lives in
// the title tooltip only.
// select-text: buttons default to user-select:none, which would make prose
// targets (journal content, visit summaries) un-copyable — and the selection
// guard in ClickToEditValue needs a real selection to detect.
const VALUE_TARGET_CLASS =
  "select-text rounded text-left underline decoration-dotted decoration-transparent underline-offset-4 transition-colors hover:decoration-muted-foreground focus-visible:decoration-muted-foreground";

export function LogChangeValue({
  onLogChange,
  ariaLabel,
  children,
}: {
  /** Null renders the value as plain content. */
  onLogChange: (() => void) | null;
  ariaLabel: string;
  children: ReactNode;
}) {
  if (!onLogChange) return <>{children}</>;
  return (
    <button
      type="button"
      onClick={onLogChange}
      aria-label={ariaLabel}
      title="Log a change"
      className={VALUE_TARGET_CLASS}
    >
      {children}
    </button>
  );
}

/**
 * For values that are themselves navigation links: the link keeps its click
 * (navigation wins), and a hover-revealed ✎ next to it carries the change
 * action — the log-change dialog for change-logged fields, the in-place
 * editor for PATCH fields. Null action renders the children plain (e.g. a
 * discontinued med's frozen shell).
 */
export function ValueEditAction({
  onAction,
  ariaLabel,
  title,
  children,
}: {
  onAction: (() => void) | null;
  ariaLabel: string;
  title: string;
  children: ReactNode;
}) {
  if (!onAction) return <>{children}</>;
  // Plain inline (not inline-flex): when the value wraps to multiple lines a
  // flex item stretches to the cell's full width and shoves the glyph to the
  // far edge — inline flow keeps the ✎ hugging the last word.
  return (
    <span className="group/value">
      {children}
      <button
        type="button"
        onClick={onAction}
        aria-label={ariaLabel}
        title={title}
        className="ml-1.5 rounded text-xs text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/value:opacity-100"
      >
        ✎
      </button>
    </span>
  );
}

/**
 * The inline-field clones' shared at-rest display branch: inert when locked
 * (frozen records), ✎-adjacent when the display is itself interactive (a nav
 * link — navigation wins), full click-to-edit target otherwise.
 */
export function InlineDisplayTarget({
  locked = false,
  interactive = false,
  ariaLabel,
  onActivate,
  children,
}: {
  locked?: boolean;
  interactive?: boolean;
  ariaLabel: string;
  onActivate: () => void;
  children: ReactNode;
}) {
  if (locked) return <>{children}</>;
  if (interactive) {
    return (
      <ValueEditAction
        onAction={onActivate}
        ariaLabel={`Edit ${ariaLabel.toLowerCase()}`}
        title="Edit"
      >
        {children}
      </ValueEditAction>
    );
  }
  return (
    <ClickToEditValue
      ariaLabel={`Edit ${ariaLabel.toLowerCase()}`}
      onActivate={onActivate}
    >
      {children}
    </ClickToEditValue>
  );
}

// Sibling for PATCH-editable (non-change-logged) fields: clicking activates
// that field's inline editor in place — no global Edit mode required.
export function ClickToEditValue({
  onActivate,
  ariaLabel,
  children,
}: {
  onActivate: () => void;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        // Large prose targets (journal content, visit summaries) must stay
        // copyable: a drag-select ends in a click on the same element, which
        // would swap the text for an editor mid-copy. A non-empty selection
        // means the user was selecting, not editing.
        if (window.getSelection()?.toString()) return;
        onActivate();
      }}
      aria-label={ariaLabel}
      title="Edit"
      className={VALUE_TARGET_CLASS}
    >
      {children}
    </button>
  );
}
