"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Textarea } from "@/components/ui/textarea";

/*
 * §6.9:1629 Notes — the user's editorial layer on an insight ("discussed with
 * Dr. Sharma", "rechecking BP next week"). The insight body is immutable AI
 * output, but Notes is user-authored and editable.
 *
 * The detail page has no global Edit mode (the body is read-only), so this is a
 * standalone inline editor: an always-available textarea that commits on blur
 * (useState + onBlur, the CLAUDE.md convention for single-field inline edits) →
 * PATCH /api/insights/[id] { notes } → router.refresh(). Empty saves as null
 * (clearing the field). `committed` tracks the last persisted value so an
 * unchanged blur is a no-op.
 */

interface ApiErrorBody {
  error?: { message?: string };
}

export function InsightNotesSection({
  insightId,
  notes,
}: {
  insightId: string;
  notes: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(notes);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const committed = useRef(notes);

  async function commit() {
    const next = draft.trim();
    if (next === committed.current) return; // unchanged → no-op
    setPending(true);
    setError(null);

    let res: Response;
    try {
      res = await fetch(`/api/insights/${insightId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: next === "" ? null : next }),
      });
    } catch {
      setError("Couldn't reach the server. Try again.");
      setPending(false);
      return;
    }

    if (res.ok) {
      committed.current = next;
      setDraft(next);
      router.refresh();
      setPending(false);
      return;
    }

    const parsed = (await res.json().catch(() => ({}))) as ApiErrorBody;
    setError(parsed.error?.message ?? "Couldn't save notes. Try again.");
    setPending(false);
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Notes
      </h2>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        disabled={pending}
        rows={3}
        aria-label="Notes"
        placeholder="Your notes on this insight — what you did, what to watch, what to raise with the doctor."
        className="text-sm leading-relaxed"
      />
      {error ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
