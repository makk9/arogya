"use client";

import { useState } from "react";

/**
 * Click-any-field-to-edit (§6.3:1238/1259) — the live-transparency substitute
 * for a confirmation gate. useState + onBlur per the inline single-field
 * convention (CLAUDE.md forms). Scope: primary text fields; enum/date fields
 * edit on the entity's own page (deferred polish, decisions.md 2026-07-22).
 */

interface InlinePatchFieldProps {
  url: string;
  field: string;
  value: string;
  className?: string;
  ariaLabel: string;
  onSaved?: () => void;
}

export function InlinePatchField({
  url,
  field,
  value,
  className,
  ariaLabel,
  onSaved,
}: InlinePatchFieldProps) {
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(value);

  async function save() {
    const next = draft.trim();
    if (next.length === 0 || next === saved) {
      setDraft(saved);
      return;
    }
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: next }),
      });
      if (!res.ok) {
        setDraft(saved);
        return;
      }
      setSaved(next);
      setDraft(next);
      onSaved?.();
    } catch {
      setDraft(saved);
    }
  }

  return (
    <input
      value={draft}
      aria-label={ariaLabel}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void save()}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setDraft(saved);
      }}
      className={`w-full rounded-sm border border-transparent bg-transparent outline-none transition-colors hover:border-border focus:border-ring ${className ?? ""}`}
    />
  );
}
