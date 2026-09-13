"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { FilePreview } from "@/components/reports/file-preview";
import { Button } from "@/components/ui/button";
import type { ExtractionEntity } from "@/lib/agents/_shared/schemas";
import { writeExtractionDraft } from "@/lib/extract/draft";
import type { EnrichmentField } from "@/lib/extract/enrichment";
import type { CommitEntityType } from "@/lib/schemas/api/extract-commit";

/*
 * §6.11 extraction confirmation. Split-panel: source left (~40%, sticky), cards
 * right (~60%, scroll). Receives BOTH upload-path and quick-log-path extractions
 * (§6.11:1718). No floating Ask AI here — the user is mid-task (§6.11:1729).
 *
 * Each card is reviewed independently: resolve ambiguity chips (block Confirm
 * until answered), pick new-vs-update where the agent was uncertain, edit fields
 * inline, then Confirm / Discard / "Edit manually instead". Commit is the only
 * write — extraction never auto-writes (§5.4:752).
 */

// `isState` — updates through a change log (dose change appends a *_changes row).
// `amendable` — an EVENT that also accepts an `update`, meaning "add to the
// existing record" (append a lab marker / a visit note, §6.7), not a change log.
// Both surface the new-vs-update toggle; vital/symptom are create-only.
const TYPE_META: Record<
  CommitEntityType,
  { label: string; plural: string; segment: string; isState: boolean; amendable?: boolean }
> = {
  medication: { label: "Medication", plural: "Medications", segment: "medications", isState: true },
  condition: { label: "Condition", plural: "Conditions", segment: "conditions", isState: true },
  doctor: { label: "Doctor", plural: "Doctors", segment: "doctors", isState: true },
  allergy: { label: "Allergy", plural: "Allergies", segment: "allergies", isState: true },
  lab_report: { label: "Lab report", plural: "Lab reports", segment: "labs", isState: false, amendable: true },
  vital_reading: { label: "Vital reading", plural: "Vital readings", segment: "vitals", isState: false },
  visit: { label: "Visit", plural: "Visits", segment: "visits", isState: false, amendable: true },
  symptom_episode: { label: "Symptom", plural: "Symptoms", segment: "symptoms", isState: false, amendable: true },
};

function isCommitType(t: string): t is CommitEntityType {
  return t in TYPE_META;
}

type CardStatus = "pending" | "committed" | "discarded";

interface CardState {
  // The live, user-editable copy of extracted_data (snake_case keys, §5.4:763).
  data: Record<string, unknown>;
  // null = uncertain bucket, user must pick before Confirm (§5.4:787).
  mode: "create" | "update" | null;
  matchedEntityId: string | null;
  status: CardStatus;
  error: string | null;
  // Per-ambiguity resolution flags, index-aligned with entity.ambiguities.
  // `intent` ambiguities are resolved by the new-vs-update toggle, not a chip.
  resolved: boolean[];
  committing: boolean;
}

export interface ExtractionConfirmationProps {
  patientId: string;
  sessionId: string;
  extractions: ExtractionEntity[];
  status: "pending" | "ready_for_confirmation" | "failed" | "committed";
  source:
    | { kind: "text"; content: string }
    | { kind: "file"; url: string; mimeType: string; filename: string }
    | { kind: "none" };
  sourceLabel: string;
  // Same-origin path to return to after commit/discard — the chat conversation
  // the log came from (§6.2:1197). Absent for the upload path → patient profile.
  returnTo?: string;
  // The chat session the log came from — the commit writes a "Logged ✓" turn
  // back to it on finalize. Absent for the upload path.
  chatSessionId?: string;
  // True when `chatSessionId` was created solely for this log. On a full discard
  // (nothing committed) we delete it so it doesn't linger as a titled empty
  // conversation with a dangling user turn.
  newChatSession?: boolean;
  // Agent advisory shown instead of / alongside cards — today, a declined
  // deletion request ("I can't delete records from here…").
  notice?: string;
  // Current markers (+ a label) of each lab report a lab card is matched to, so
  // an update card can show `old → new` corrections and "new marker" appends.
  // Keyed by matched lab-report id.
  labSnapshots?: Record<string, LabSnapshot>;
  // Current value of each overwrite field (agent-key → value) for visit/symptom
  // update cards, so a replacement shows `old → new`. Keyed by matched entity id.
  fieldSnapshots?: Record<string, Record<string, string>>;
  // Per-type "worth capturing" optional fields (decisions.md 2026-07-17) — a
  // create card surfaces the ones it hasn't filled as inline "add" chips.
  enrichmentFields?: Record<CommitEntityType, readonly EnrichmentField[]>;
  // Closed-enum values per entity type + agent key (ENUM_FIELD_VALUES). Any
  // value outside these lists is dropped by the commit mapper's `enumMember`,
  // so the card never offers one: agent ambiguity options are filtered against
  // them and enum fields edit as a picker.
  enumFields?: Record<CommitEntityType, Readonly<Record<string, readonly string[]>>>;
}

export interface LabSnapshot {
  label: string;
  markers: Array<{ marker: string; value: string; unit: string }>;
}

function initialMode(intent: ExtractionEntity["intent"]): CardState["mode"] {
  if (intent === "update") return "update";
  if (intent === "create") return "create";
  return null; // uncertain
}

function scalarString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function ExtractionConfirmation({
  patientId,
  sessionId,
  extractions,
  status,
  source,
  sourceLabel,
  returnTo,
  chatSessionId,
  newChatSession,
  notice,
  labSnapshots,
  fieldSnapshots,
  enrichmentFields,
  enumFields,
}: ExtractionConfirmationProps) {
  const router = useRouter();

  const [cards, setCards] = useState<CardState[]>(() =>
    extractions.map((e) => ({
      data: { ...e.extracted_data },
      mode: initialMode(e.intent),
      matchedEntityId: e.matched_entity_id,
      status: "pending" as const,
      error: null,
      // Ambiguities on the `intent` field are answered by the toggle.
      resolved: e.ambiguities.map((a) => a.field === "intent"),
      committing: false,
    })),
  );
  const [banner, setBanner] = useState<string | null>(null);
  // Review close-out flags. Set in the same batched update as the card change
  // that triggered them, so the end-of-review effect below always sees them:
  //  - reviewEnded: finalize sent / navigation started — concurrent paths
  //    never double-finalize or double-navigate.
  //  - leaving: "Edit manually instead" navigates to the form itself — the
  //    effect must not yank the user back to the chat.
  const [reviewEnded, setReviewEnded] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const isFailure = status === "failed" || extractions.length === 0;

  // A card blocks Confirm when it has an unresolved (non-intent) ambiguity or
  // its bucket is still uncertain (§6.11:1730-1731).
  function isBlocked(i: number): boolean {
    const card = cards[i];
    if (card.mode === null) return true;
    return card.resolved.some((r) => !r);
  }

  const pendingIndices = cards
    .map((c, i) => (c.status === "pending" ? i : -1))
    .filter((i) => i >= 0);
  const anyBlocked = pendingIndices.some((i) => isBlocked(i));
  const confirmAllCount = pendingIndices.length;

  async function commit(indices: number[]) {
    if (indices.length === 0) return;
    setBanner(null);
    setCards((prev) => {
      const next = [...prev];
      for (const i of indices) next[i] = { ...next[i], committing: true, error: null };
      return next;
    });

    // finalize when this batch clears the last pending card. A card whose own
    // commit is still in flight counts as pending, so two concurrent confirms
    // both send finalize:false — the end-of-review effect below then closes the
    // session once the last one lands.
    const remainingAfter = pendingIndices.filter((i) => !indices.includes(i));
    const finalize = remainingAfter.length === 0;

    const payloadCards = indices.map((i) => {
      const card = cards[i];
      const entity = extractions[i];
      return {
        targetEntityType: entity.target_entity_type,
        mode: card.mode ?? "create",
        matchedEntityId: card.matchedEntityId,
        data: card.data,
      };
    });

    try {
      const res = await fetch(`/api/extract/${sessionId}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: payloadCards, finalize, chatSessionId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setCards((prev) => {
          const next = [...prev];
          for (const i of indices) next[i] = { ...next[i], committing: false };
          return next;
        });
        setBanner(body?.error?.message ?? "Something went wrong committing. Try again.");
        return;
      }
      const body = (await res.json()) as {
        results: Array<{ ok: boolean; error?: string }>;
        finalized: boolean;
      };

      setCards((prev) => {
        const next = [...prev];
        indices.forEach((cardIdx, k) => {
          const r = body.results[k];
          next[cardIdx] = r?.ok
            ? { ...next[cardIdx], status: "committed", committing: false, error: null }
            : { ...next[cardIdx], committing: false, error: r?.error ?? "Couldn't commit this card." };
        });
        return next;
      });

      if (body.finalized && !reviewEnded) {
        setReviewEnded(true);
        // Return to the chat conversation the log came from (§6.2:1197); the
        // upload path has no origin, so it lands on the patient profile (no
        // dashboard yet, E0a). Toast on finalize deferred with the dashboard.
        router.push(returnTo ?? `/patient/${patientId}`);
        router.refresh();
      }
    } catch {
      setCards((prev) => {
        const next = [...prev];
        for (const i of indices) next[i] = { ...next[i], committing: false };
        return next;
      });
      setBanner("I couldn't reach the server. Check your connection and try again.");
    }
  }

  // Pure card-status mutation — no navigation. Used by the Discard handler below
  // and by "Edit manually instead" (which navigates to the form itself).
  function markDiscarded(i: number) {
    setCards((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], status: "discarded" };
      return next;
    });
  }

  // Close out the review and leave the confirmation surface.
  //  - If cards were committed, flush a finalize-only commit (empty `cards`) so
  //    the session + report flip to `committed` instead of dangling in
  //    `ready_for_confirmation` — otherwise the quick-log stub report stays
  //    `extracting` and its committed entities' `source_report_id` citations
  //    won't resolve. Then return to the chat the log came from.
  //  - If nothing committed and the chat session was created solely for this
  //    log, delete it (dangling turn + titled empty session) and land on the
  //    chat index rather than the now-gone session.
  //  - `navigate: false` finalizes without leaving (the caller navigates).
  async function endReview(
    anyCommitted: boolean,
    { navigate = true }: { navigate?: boolean } = {},
  ) {
    if (reviewEnded) return;
    setReviewEnded(true);
    if (anyCommitted) {
      try {
        await fetch(`/api/extract/${sessionId}/commit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cards: [], finalize: true, chatSessionId }),
        });
      } catch {
        // Non-fatal — the entities already wrote; navigate regardless.
      }
      if (!navigate) return;
    } else if (newChatSession && chatSessionId) {
      try {
        await fetch(`/api/chat/sessions/${chatSessionId}`, { method: "DELETE" });
      } catch {
        // Non-fatal — navigate regardless.
      }
      router.push(`/patient/${patientId}/chat`);
      router.refresh();
      return;
    }
    router.push(returnTo ?? `/patient/${patientId}`);
    router.refresh();
  }

  function discard(i: number) {
    // Was this the last pending card? If so the review is over — don't strand
    // the user on a page whose header controls have vanished (count → 0). A card
    // still committing counts as pending; the effect below finalizes once it
    // lands.
    const stillPending = cards.some(
      (c, idx) => idx !== i && c.status === "pending",
    );
    const anyCommitted = cards.some((c) => c.status === "committed");
    markDiscarded(i);
    if (!stillPending) void endReview(anyCommitted);
  }

  // End-of-review catch-all: once nothing is pending and something committed,
  // close the session. Covers the interleavings the click-time paths can't see —
  // e.g. confirm A, then confirm/discard B before A returns, where every request
  // went out with finalize:false.
  useEffect(() => {
    if (reviewEnded || leaving) return;
    if (cards.length === 0) return;
    if (cards.some((c) => c.status === "pending")) return;
    if (!cards.some((c) => c.status === "committed")) return;
    // Deferred so the finalize's navigation isn't started from the effect body.
    queueMicrotask(() => void endReview(true));
  });

  function discardAll() {
    // Abandon every pending card — same end-of-review path as clearing the last
    // one individually (finalize if some committed, else clean up + return).
    void endReview(cards.some((c) => c.status === "committed"));
  }

  function setField(i: number, key: string, value: string) {
    setCards((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], data: { ...next[i].data, [key]: value } };
      return next;
    });
  }

  // `value === null` is the "not sure" escape: the question is answered by
  // declining it, so the card unblocks and whatever the agent extracted stands.
  // Every ambiguity needs SOME resolution path — an open question the agent
  // raised with no candidate options used to strand the card with Confirm
  // permanently disabled and only Discard left.
  function resolveAmbiguity(
    i: number,
    ambIdx: number,
    field: string,
    value: string | null,
  ) {
    setCards((prev) => {
      const next = [...prev];
      const card = next[i];
      const resolved = [...card.resolved];
      resolved[ambIdx] = true;
      next[i] = {
        ...card,
        resolved,
        data: value === null ? card.data : { ...card.data, [field]: value },
      };
      return next;
    });
  }

  function setMode(i: number, mode: "create" | "update") {
    setCards((prev) => {
      const next = [...prev];
      const card = next[i];
      // Picking a bucket resolves any `intent` ambiguity on this card.
      const resolved = card.resolved.map((r, idx) =>
        extractions[i].ambiguities[idx]?.field === "intent" ? true : r,
      );
      next[i] = { ...card, mode, resolved };
      return next;
    });
  }

  function editManually(i: number) {
    const entity = extractions[i];
    if (isCommitType(entity.target_entity_type)) {
      writeExtractionDraft(entity.target_entity_type, cards[i].data);
      const segment = TYPE_META[entity.target_entity_type].segment;
      // Mark discarded WITHOUT the end-of-review navigation — we're navigating to
      // the manual form ourselves, not abandoning the review. If this was the
      // last pending card and others committed, still finalize the session
      // (flips the quick-log report to `committed` so citations resolve).
      const stillPending = cards.some(
        (c, idx) => idx !== i && c.status === "pending",
      );
      if (!stillPending && cards.some((c) => c.status === "committed")) {
        void endReview(true, { navigate: false });
      }
      setLeaving(true);
      markDiscarded(i);
      router.push(`/patient/${patientId}/${segment}/new`);
    }
  }

  // Group pending/committed cards by entity type for the §6.11:1736 headers.
  const groups = useMemo(() => {
    const byType = new Map<string, number[]>();
    extractions.forEach((e, i) => {
      const list = byType.get(e.target_entity_type) ?? [];
      list.push(i);
      byType.set(e.target_entity_type, list);
    });
    return [...byType.entries()];
  }, [extractions]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <nav className="mb-4 text-xs text-muted-foreground">
        <span>/ patient / </span>
        <span>extract / </span>
        <span className="font-mono">{sessionId.slice(0, 8)}</span>
      </nav>

      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Review extraction</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isFailure
              ? `From ${sourceLabel} · nothing reliable to extract`
              : `From ${sourceLabel} · ${extractions.length} ${
                  extractions.length === 1 ? "entity" : "entities"
                } found${anyBlocked ? ` · ${pendingIndices.filter(isBlocked).length} need your call` : ""}`}
          </p>
        </div>
        {!isFailure && confirmAllCount > 0 ? (
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={discardAll}
              className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Discard all
            </button>
            <Button
              type="button"
              disabled={anyBlocked || pendingIndices.some((i) => cards[i].committing)}
              onClick={() => commit(pendingIndices)}
            >
              {anyBlocked
                ? `Confirm all · ${confirmAllCount} blocked`
                : `Confirm all · ${confirmAllCount} →`}
            </Button>
          </div>
        ) : null}
      </header>

      {banner ? (
        <div className="mb-4 rounded-md border border-border bg-muted px-4 py-2 text-sm text-foreground">
          {banner}
        </div>
      ) : null}

      {/* Agent advisory alongside cards — the mixed case where a note both logged
          something AND asked for something the agent can't do (e.g. a deletion).
          A decline with NO extractions is handled inline in the chat, not here. */}
      {notice ? (
        <div className="mb-4 rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground">
          {notice}
        </div>
      ) : null}

      {anyBlocked ? (
        <p className="mb-4 text-xs text-muted-foreground">
          Resolve the highlighted questions on each card before confirming everything.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[2fr_3fr]">
        {/* Source panel — sticky on scroll (§6.11:1810) */}
        <section className="md:sticky md:top-6 md:self-start">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {source.kind === "text" ? "Source · text input" : "Source"}
            </h2>
          </div>
          {source.kind === "text" ? (
            <div className="whitespace-pre-wrap rounded-lg border border-border bg-muted p-4 font-mono text-sm text-foreground">
              {source.content}
            </div>
          ) : source.kind === "file" ? (
            <div>
              <FilePreview url={source.url} mimeType={source.mimeType} filename={source.filename} />
              <p className="mt-2 text-xs text-muted-foreground">
                {source.filename} · {isFailure ? "extraction failed" : "uploaded"}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No source available.</p>
          )}
          {/*
            §6.11's `replace file →` recovery is an UPLOAD-path affordance ("I
            attached the wrong file") — it has no meaning for a typed text log,
            and the file-upload entry UI doesn't exist yet (E2 shipped the
            backend only). It returns here, wired to the real re-upload flow,
            when that UI lands. Until then a wrong source is handled by
            "Discard all" (→ back to where you came from).
          */}
        </section>

        {/* Cards / failure state */}
        <section className="flex flex-col gap-6">
          {isFailure ? (
            <FailureState router={router} returnTo={returnTo} />
          ) : (
            groups.map(([type, indices]) => {
              const meta = isCommitType(type) ? TYPE_META[type] : null;
              return (
                <div key={type} className="flex flex-col gap-4">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {meta ? meta.plural : type} · {indices.length}
                  </h3>
                  {indices.map((i) => (
                    <Card
                      key={i}
                      entity={extractions[i]}
                      card={cards[i]}
                      blocked={isBlocked(i)}
                      labSnapshot={
                        cards[i].matchedEntityId
                          ? labSnapshots?.[cards[i].matchedEntityId as string]
                          : undefined
                      }
                      fieldSnapshot={
                        cards[i].matchedEntityId
                          ? fieldSnapshots?.[cards[i].matchedEntityId as string]
                          : undefined
                      }
                      enrichmentList={
                        isCommitType(type) ? enrichmentFields?.[type] : undefined
                      }
                      enumMap={isCommitType(type) ? enumFields?.[type] : undefined}
                      onField={(k, v) => setField(i, k, v)}
                      onResolve={(ambIdx, field, value) =>
                        resolveAmbiguity(i, ambIdx, field, value)
                      }
                      onMode={(m) => setMode(i, m)}
                      onConfirm={() => commit([i])}
                      onDiscard={() => discard(i)}
                      onEditManually={() => editManually(i)}
                    />
                  ))}
                </div>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}

function FailureState({
  router,
  returnTo,
}: {
  router: ReturnType<typeof useRouter>;
  returnTo?: string;
}) {
  // Only the text (quick-log) path reaches users today — the file-upload entry
  // UI isn't built — so the guidance is text-oriented. When uploads land, branch
  // the copy + a "try a different file" action on the source kind.
  return (
    <div className="rounded-lg border border-dashed border-border p-8">
      <p className="text-lg text-muted-foreground">?</p>
      <p className="mt-2 text-lg font-medium text-foreground">
        I couldn&apos;t reliably read this
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        There wasn&apos;t enough here to pull structured details out. Go back and
        try rephrasing with specifics — the name, the number, and a date.
      </p>
      <div className="mt-4">
        <Button onClick={() => (returnTo ? router.push(returnTo) : router.back())}>
          {returnTo ? "Back to chat" : "Go back"}
        </Button>
      </div>
      <div className="mt-6 border-t border-border pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Things that usually help
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Name the medication, lab, or vital explicitly</li>
          <li>Include numbers with units — e.g. 40 mg, 152/95</li>
          <li>Keep it to one change or reading per note</li>
          <li>Add a date if it wasn&apos;t today</li>
        </ul>
      </div>
    </div>
  );
}

function markerField(r: unknown, key: string): string {
  if (typeof r !== "object" || r === null) return "";
  const v = (r as Record<string, unknown>)[key];
  return v === null || v === undefined ? "" : String(v);
}

// Inline field editor — a select for enum fields, a date picker for dates, plain
// text otherwise. Commits on blur / Enter / change so the value lands in the
// card's data (and thus the commit).
function FieldEditor({
  value,
  kind,
  options,
  onCommit,
}: {
  value: string;
  kind: EnrichmentField["kind"];
  options: readonly string[];
  onCommit: (v: string) => void;
}) {
  const cls = "w-full rounded border border-border bg-background px-2 py-0.5 text-sm";
  if (kind === "select") {
    return (
      <select autoFocus defaultValue={value} onChange={(e) => onCommit(e.target.value)} className={cls}>
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      autoFocus
      type={kind === "date" ? "date" : "text"}
      defaultValue={value}
      onBlur={(e) => onCommit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit((e.target as HTMLInputElement).value);
      }}
      className={cls}
    />
  );
}

// The client-side twin of commit.ts's `enumMember`: resolves a loosely-written
// value to the enum member it means, canonically cased ("Severe" → "severe",
// "In remission" → "in_remission"), or null when it isn't one. The mapper is
// strict, so anything this rejects would be dropped at commit.
function enumMember(value: string, values: readonly string[]): string | null {
  const norm = (v: string) => v.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const target = norm(value);
  return values.find((v) => norm(v) === target) ?? null;
}

// An ambiguity on a closed-enum field whose options didn't survive the filter
// above (or never offered a real choice) — answered from the field's own values
// so whatever the user picks is a value the record can actually hold.
function EnumAnswer({
  values,
  onAnswer,
}: {
  values: readonly string[];
  onAnswer: (value: string) => void;
}) {
  return (
    <select
      defaultValue=""
      onChange={(e) => {
        if (e.target.value) onAnswer(e.target.value);
      }}
      className="mt-2 rounded border border-border bg-background px-2 py-1 text-sm"
    >
      <option value="">Pick one —</option>
      {values.map((v) => (
        <option key={v} value={v}>
          {v.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}

// An ambiguity the agent raised WITHOUT candidate options (an open question like
// "when did these episodes start?"). Chips can't answer it, so it gets a typed
// answer — committed explicitly, never on blur, so a stray click can't resolve a
// question with an empty value.
function AmbiguityAnswer({
  kind,
  onAnswer,
}: {
  kind: EnrichmentField["kind"];
  onAnswer: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const trimmed = value.trim();
  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        type={kind === "date" ? "date" : "text"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && trimmed) {
            e.preventDefault();
            onAnswer(trimmed);
          }
        }}
        className="w-56 rounded border border-border bg-background px-2 py-1 text-sm"
      />
      <button
        type="button"
        disabled={!trimmed}
        onClick={() => onAnswer(trimmed)}
        className="rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:hover:bg-card disabled:hover:text-foreground"
      >
        Save
      </button>
    </div>
  );
}

// Readable markers for a lab card. On an update it diffs each extracted marker
// against the matched report's current markers: a value change shows `old → new`
// (labelled "correcting"), a marker not on the report shows "new marker". On a
// create it's just the list. This is what makes an update legible — the user
// sees exactly which report changes and how, not a JSON blob.
function LabMarkersView({
  results,
  snapshot,
  mode,
}: {
  results: unknown[];
  snapshot?: LabSnapshot;
  mode: "create" | "update" | null;
}) {
  const isUpdate = mode === "update";
  const priorByName = new Map(
    (snapshot?.markers ?? []).map((m) => [m.marker.trim().toLowerCase(), m]),
  );
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Markers
        </p>
        {isUpdate && snapshot ? (
          <p className="truncate text-xs text-muted-foreground">on {snapshot.label}</p>
        ) : null}
      </div>
      <div className="mt-1 flex flex-col gap-1 text-sm">
        {results.map((r, i) => {
          const name = markerField(r, "marker");
          const value = markerField(r, "value");
          const unit = markerField(r, "unit");
          const newLabel = [value, unit].filter(Boolean).join(" ") || "—";
          const prior = isUpdate
            ? priorByName.get(name.trim().toLowerCase())
            : undefined;
          return (
            <div key={i} className="flex items-baseline justify-between gap-3">
              <span className="shrink-0 text-muted-foreground">{name || "—"}</span>
              <span className="text-right text-foreground">
                {prior ? (
                  prior.value !== value ? (
                    <>
                      <span className="text-muted-foreground line-through">
                        {[prior.value, prior.unit].filter(Boolean).join(" ")}
                      </span>{" "}
                      → {newLabel}{" "}
                      <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[0.65rem] text-accent-foreground">
                        correcting
                      </span>
                    </>
                  ) : (
                    <>
                      {newLabel}{" "}
                      <span className="text-xs text-muted-foreground">(unchanged)</span>
                    </>
                  )
                ) : (
                  <>
                    {newLabel}
                    {isUpdate ? (
                      <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">
                        new marker
                      </span>
                    ) : null}
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
      {isUpdate && !snapshot ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Choose “Update existing” to add these to the matched report.
        </p>
      ) : null}
    </div>
  );
}

interface CardProps {
  entity: ExtractionEntity;
  card: CardState;
  blocked: boolean;
  labSnapshot?: LabSnapshot;
  fieldSnapshot?: Record<string, string>;
  enrichmentList?: readonly EnrichmentField[];
  enumMap?: Readonly<Record<string, readonly string[]>>;
  onField: (key: string, value: string) => void;
  onResolve: (ambIdx: number, field: string, value: string | null) => void;
  onMode: (mode: "create" | "update") => void;
  onConfirm: () => void;
  onDiscard: () => void;
  onEditManually: () => void;
}

function Card({
  entity,
  card,
  blocked,
  labSnapshot,
  fieldSnapshot,
  enrichmentList,
  enumMap,
  onField,
  onResolve,
  onMode,
  onConfirm,
  onDiscard,
  onEditManually,
}: CardProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  // The optional field kind (enum-select / date / text) for the inline editor —
  // an extracted enum edits as a select, a date as a date input, etc.
  // Not every extracted key is an enrichment field (the agent can raise a
  // question about one, or fill a field the "add more" chips don't offer). Fall
  // back to the enum map — a closed-enum field typed as free text is dropped at
  // commit — then to a date input for date-shaped keys, since a free-text date
  // parses to `now` in the commit mapper.
  const kindOf = (key: string): EnrichmentField["kind"] =>
    enrichmentList?.find((f) => f.key === key)?.kind ??
    (enumMap?.[key]
      ? "select"
      : /(?:_at|_on|_date|^date$)$/.test(key)
        ? "date"
        : "text");
  const optionsOf = (key: string): readonly string[] =>
    enrichmentList?.find((f) => f.key === key)?.options ?? enumMap?.[key] ?? [];
  const meta = isCommitType(entity.target_entity_type)
    ? TYPE_META[entity.target_entity_type]
    : null;
  const canUpdate = meta?.isState === true || meta?.amendable === true;
  // Lab cards render their markers as a readable table (with old→new on an
  // update), not the generic key/value list — so `results` is pulled out here.
  const isLab = entity.target_entity_type === "lab_report";
  const labResults =
    isLab && Array.isArray(card.data.results)
      ? (card.data.results as unknown[])
      : null;
  // Guided-scribe (decisions.md 2026-07-17): high-value optional fields this card
  // hasn't filled, offered as "add" chips. Only for a CREATE — an update/amend is
  // a targeted change, not a place to flesh out a record.
  const addableFields = (enrichmentList ?? []).filter(
    (f) => !(f.key in card.data),
  );

  if (card.status === "discarded") {
    return (
      <article className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        {meta?.label ?? entity.target_entity_type} · discarded
      </article>
    );
  }
  if (card.status === "committed") {
    return (
      <article className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        ✓ {meta?.label ?? entity.target_entity_type} · saved to the record
      </article>
    );
  }

  // Which fields are the target of an unresolved ambiguity → render "(pending)".
  const pendingFields = new Set(
    entity.ambiguities
      .filter((a, idx) => a.field !== "intent" && !card.resolved[idx])
      .map((a) => a.field),
  );

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {meta?.label ?? entity.target_entity_type}
        </h4>
        <span
          className={
            blocked
              ? "rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground"
              : "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
          }
        >
          {blocked ? "needs your call" : "confident"}
        </span>
      </div>

      {/* Ambiguity prompts (non-intent) with inline-resolve chips */}
      {entity.ambiguities.map((a, ambIdx) => {
        if (a.field === "intent" || card.resolved[ambIdx]) return null;
        // On a closed-enum field, only real enum members can be offered — the
        // commit mapper drops anything else, so a chip like "Right knee" for
        // `body_area` would read as saved and silently vanish. Members are
        // matched leniently ("Severe", "in remission") and offered canonically;
        // if fewer than two survive there's no real choice left, so the field's
        // own values are offered as a picker instead.
        const enumValues = enumMap?.[a.field];
        const choices = enumValues
          ? [...new Set(a.options.map((o) => enumMember(o, enumValues)).filter((o): o is string => o !== null))]
          : a.options;
        const asPicker = enumValues !== undefined && choices.length < 2;
        return (
          <div
            key={ambIdx}
            className="mt-3 rounded-md border border-border bg-muted px-3 py-2"
          >
            <p className="text-sm text-foreground">⚠ {a.question}</p>
            {asPicker ? (
              <EnumAnswer
                values={enumValues}
                onAnswer={(val) => onResolve(ambIdx, a.field, val)}
              />
            ) : choices.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {choices.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onResolve(ambIdx, a.field, opt)}
                    className="rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              // Open question — the agent had no candidates to offer, so the
              // answer is typed rather than picked.
              <AmbiguityAnswer
                kind={kindOf(a.field)}
                onAnswer={(val) => onResolve(ambIdx, a.field, val)}
              />
            )}
            <button
              type="button"
              onClick={() => onResolve(ambIdx, a.field, null)}
              className="mt-2 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              {scalarString(card.data[a.field])
                ? `Not sure — keep “${scalarString(card.data[a.field])}”`
                : "Not sure — leave this out"}
            </button>
          </div>
        );
      })}

      {/* New-vs-update toggle (state entities only) */}
      {canUpdate ? (
        <div className="mt-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onMode("update")}
              disabled={card.matchedEntityId === null}
              className={
                card.mode === "update"
                  ? "rounded-md bg-accent px-3 py-1 text-xs text-accent-foreground"
                  : "rounded-md border border-border px-3 py-1 text-xs text-muted-foreground disabled:opacity-40"
              }
            >
              Update existing
            </button>
            <button
              type="button"
              onClick={() => onMode("create")}
              className={
                card.mode === "create"
                  ? "rounded-md bg-accent px-3 py-1 text-xs text-accent-foreground"
                  : "rounded-md border border-border px-3 py-1 text-xs text-muted-foreground"
              }
            >
              Create new
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {card.mode === null
              ? "Your call — this could match an existing record."
              : card.mode === "update"
                ? meta?.amendable
                  ? "Will add to the matched record."
                  : "Will update the matched record in place."
                : "Will add a new record."}
          </p>
        </div>
      ) : null}

      {/* Lab markers — readable, with old→new on an update */}
      {labResults ? (
        <LabMarkersView results={labResults} snapshot={labSnapshot} mode={card.mode} />
      ) : null}

      {/* Fields with per-field inline edit (lab `results` handled above) */}
      <dl className="mt-3 flex flex-col gap-1 text-sm">
        {Object.entries(card.data)
          .filter(([k]) => !(isLab && k === "results"))
          .map(([k, v]) => {
            const isObject = typeof v === "object" && v !== null;
            const isPending = pendingFields.has(k);
            const newVal = scalarString(v);
            // On an update, show the current value being replaced (`old → new`)
            // for overwrite fields — the same legibility labs get. Notes append,
            // so they aren't in the snapshot and render plainly.
            const oldVal =
              card.mode === "update" ? fieldSnapshot?.[k] : undefined;
            const showDiff =
              oldVal !== undefined && oldVal !== newVal && editingField !== k;
            return (
              <div key={k} className="flex items-baseline justify-between gap-3">
                <dt className="w-32 shrink-0 text-muted-foreground">{k}</dt>
                <dd className="flex-1 text-foreground">
                  {isPending ? (
                    <span className="italic text-muted-foreground">(pending)</span>
                  ) : editingField === k && !isObject ? (
                    <FieldEditor
                      value={newVal}
                      kind={kindOf(k)}
                      options={optionsOf(k)}
                      onCommit={(val) => {
                        onField(k, val);
                        setEditingField(null);
                      }}
                    />
                  ) : (
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="break-words">
                        {showDiff ? (
                          <>
                            <span className="text-muted-foreground line-through">
                              {oldVal}
                            </span>{" "}
                            → {newVal || "—"}
                          </>
                        ) : (
                          newVal || "—"
                        )}
                      </span>
                      {!isObject ? (
                        <button
                          type="button"
                          onClick={() => setEditingField(k)}
                          className="shrink-0 text-xs text-link underline underline-offset-2"
                        >
                          edit
                        </button>
                      ) : null}
                    </span>
                  )}
                </dd>
              </div>
            );
        })}
      </dl>

      {card.mode !== "update" && addableFields.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Add more:</span>
          {addableFields.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                onField(f.key, "");
                setEditingField(f.key);
              }}
              className="rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:border-foreground hover:text-foreground"
            >
              + {f.label}
            </button>
          ))}
        </div>
      ) : null}

      {card.error ? (
        <p className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
          {card.error}
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onEditManually}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Edit manually instead
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={card.committing}
            onClick={onDiscard}
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Discard
          </button>
          <Button type="button" size="sm" disabled={blocked || card.committing} onClick={onConfirm}>
            {card.committing ? "Saving…" : "Confirm"}
          </Button>
        </div>
      </div>
    </article>
  );
}
