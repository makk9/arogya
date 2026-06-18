"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useMaybeEpisodeEdit } from "@/components/symptoms/episode-edit-context";
import {
  CONTEXT_LABEL,
  FLAG_LABEL,
  READING_TYPE_LABEL,
  formatVitalValue,
} from "@/components/vitals/vital-options";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VitalReading } from "@/db/schema";
import { cn } from "@/lib/utils";
import { formatAbsoluteDate } from "@/lib/datetime";

/*
 * The §6.7 Outcomes section, renamed "Captured at this episode" for symptom
 * episodes (§6.7:1533) — the vital readings logged at the same time
 * (linked_vital_ids). Forward-attached measurements, non-navigating (vitals have
 * no detail page in v1). A flagged reading (low/high/critical) carries the `△`
 * warning glyph + a flag pill (the demo-moment "dizziness + low BP" signal).
 *
 * In **Edit mode** the section is also the manual post-hoc linking surface: each
 * linked reading gets a Remove control, and an "+ Link a reading" select offers
 * the patient's other readings. Each change PATCHes the episode's whole
 * linked_vital_ids array (replace semantics). Readings are still *created*
 * elsewhere (`/vitals/new` / Phase E chat) — this only links existing ones,
 * which keeps it same-entity editing, not a cross-entity creation affordance.
 */

interface Props {
  linkedVitals: VitalReading[];
  allVitals: VitalReading[];
}

function isFlagged(flag: VitalReading["flag"]): boolean {
  return flag === "low" || flag === "high" || flag === "critical";
}

function readingLabel(v: VitalReading): string {
  return `${READING_TYPE_LABEL[v.readingType] ?? v.readingType} ${formatVitalValue(v)} · ${formatAbsoluteDate(v.recordedAt)}`;
}

export function EpisodeCapturedSection({ linkedVitals, allVitals }: Props) {
  const editCtx = useMaybeEpisodeEdit();
  const editing = editCtx?.editing ?? false;
  const episodeId = editCtx?.episodeId;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read mode with nothing captured → omit the section (§6.5 omission rule).
  if (!editing && linkedVitals.length === 0) return null;

  const linkedIds = linkedVitals.map((v) => v.id);
  const linkedIdSet = new Set(linkedIds);
  const available = allVitals.filter((v) => !linkedIdSet.has(v.id));
  const availableItems = available.map((v) => ({
    value: v.id,
    label: readingLabel(v),
  }));

  const patchLinks = async (nextIds: string[]) => {
    if (!episodeId) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/symptom-episodes/${episodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedVitalIds: nextIds }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      const parsed = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      setError(parsed.error?.message ?? "Couldn't update linked readings.");
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Captured at this episode
      </h2>

      {linkedVitals.length > 0 ? (
        <div className="flex flex-col gap-2">
          {linkedVitals.map((v) => {
            const flagged = isFlagged(v.flag);
            return (
              <div
                key={v.id}
                className={cn(
                  "rounded-lg border px-4 py-3",
                  flagged
                    ? "border-accent-foreground/25 bg-accent/50"
                    : "border-border bg-card",
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">
                    {flagged ? (
                      <span aria-hidden className="mr-1.5 text-muted-foreground">
                        △
                      </span>
                    ) : null}
                    {READING_TYPE_LABEL[v.readingType] ?? v.readingType} ·{" "}
                    {formatVitalValue(v)}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    {flagged && v.flag ? (
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                        {FLAG_LABEL[v.flag] ?? v.flag}
                      </span>
                    ) : null}
                    {editing ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          void patchLinks(linkedIds.filter((id) => id !== v.id))
                        }
                        className="text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    ) : null}
                  </span>
                </div>
                {v.context || v.notes ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[
                      v.context ? CONTEXT_LABEL[v.context] ?? v.context : null,
                      v.notes,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {editing ? (
        <div className={linkedVitals.length > 0 ? "mt-3" : ""}>
          {available.length > 0 ? (
            <Select
              value={null}
              items={availableItems}
              disabled={pending}
              onValueChange={(id) => {
                if (id) void patchLinks([...linkedIds, id]);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="+ Link a reading…" />
              </SelectTrigger>
              <SelectContent>
                {availableItems.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-xs text-muted-foreground">
              {allVitals.length === 0
                ? "No readings on file to link yet — log one first, then link it here."
                : "All your readings are already linked to this episode."}
            </p>
          )}
          {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
