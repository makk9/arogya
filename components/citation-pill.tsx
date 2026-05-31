"use client";

/**
 * Visual citation pill. Two variants — vault (`§ entity-type:slug`) and external
 * (`↗ source-name`) — distinguishable per design.md 6.2:1204-1205.
 *
 * Interactivity (Phase C item 7): vault `med` pills are clickable and open a
 * popover with an entity preview + `View full →` link to the medication detail
 * page (6.2:1206, 6.2:1216). All other pills — non-`med` vault citations and
 * external citations — stay inert spans, because their detail pages don't exist
 * until Phase D, so a popover would dead-end. As more state-entity detail pages
 * land, extend the interactive branch.
 *
 * Color: stone-only neutrals, intentionally. The brand accent is deferred per
 * the 2026-05-20 palette reset (see app/globals.css + decisions.md); the pill
 * stays on neutral tokens — vault and external remain distinguishable by their
 * two near-identical grays — until a brand accent is locked. Do not introduce a
 * new pill color before that decision.
 */

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface VaultPillProps {
  variant: "vault";
  entityType: string;
  slug: string;
  children: ReactNode;
}

interface ExternalPillProps {
  variant: "external";
  sourceName: string;
  children: ReactNode;
}

export type CitationPillProps = VaultPillProps | ExternalPillProps;

// Shared base styling so the interactive med pill is visually identical to the
// inert spans — the popover affordance is the only difference.
const VAULT_PILL_CLASS =
  "inline-flex items-baseline rounded-full bg-stone-100 px-2 py-0.5 font-mono text-[0.85em] text-stone-700 ring-1 ring-stone-200";

export function CitationPill(props: CitationPillProps): ReactNode {
  if (props.variant === "external") {
    return (
      <span
        data-citation-type="external"
        data-source-name={props.sourceName}
        className="inline-flex items-baseline rounded-full bg-stone-200 px-2 py-0.5 font-mono text-[0.85em] text-stone-800 ring-1 ring-stone-300"
      >
        {props.children}
      </span>
    );
  }

  // Only medication citations are interactive in Phase C. `slug` is the bare
  // slug (the parser strips the `med:` prefix into `entityType`).
  if (props.entityType === "med" && props.slug.length > 0) {
    return (
      <MedCitationPill slug={props.slug}>{props.children}</MedCitationPill>
    );
  }

  return (
    <span
      data-citation-type="vault"
      data-entity-type={props.entityType}
      data-slug={props.slug}
      className={VAULT_PILL_CLASS}
    >
      {props.children}
    </span>
  );
}

interface MedPreview {
  id: string;
  patientId: string;
  name: string;
  currentDose: string;
  currentFrequency: string;
  status: "active" | "paused" | "discontinued";
}

type FetchState = "idle" | "loading" | "loaded" | "not-found" | "error";

const STATUS_LABEL: Record<MedPreview["status"], string> = {
  active: "Active",
  paused: "Paused",
  discontinued: "Discontinued",
};

function MedCitationPill({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<FetchState>("idle");
  const [preview, setPreview] = useState<MedPreview | null>(null);
  // Guards against a refetch on re-open and against a double-fetch from rapid
  // clicks (the `state` closure is stale within a single tick).
  const requestedRef = useRef(false);

  // Fetch on the open click — deliberate intent, never while the reader merely
  // scans text containing pills. Lives in the open handler (not an effect): the
  // fetch is an event response, not state synchronization.
  function handleOpenChange(next: boolean): void {
    setOpen(next);
    if (!next || requestedRef.current) return;
    requestedRef.current = true;
    setState("loading");
    fetch(`/api/medications/by-slug/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        // 404 is a definitive answer (the med isn't resolvable) — stay guarded.
        if (res.status === 404) {
          setState("not-found");
          return;
        }
        // A transient failure must be retryable: drop the guard so re-opening
        // the popover refetches — otherwise the "try again" copy is a dead end.
        if (!res.ok) {
          setState("error");
          requestedRef.current = false;
          return;
        }
        const json: { medication: MedPreview } = await res.json();
        setPreview(json.medication);
        setState("loaded");
      })
      .catch(() => {
        setState("error");
        requestedRef.current = false;
      });
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        data-citation-type="vault"
        data-entity-type="med"
        data-slug={slug}
        className={`${VAULT_PILL_CLASS} cursor-pointer transition-colors hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-400`}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent align="start" className="font-sans">
        {state === "loading" || state === "idle" ? (
          <p className="text-muted-foreground">Looking this up…</p>
        ) : null}

        {state === "error" ? (
          <p className="text-muted-foreground">
            That didn&apos;t load. Try again in a moment.
          </p>
        ) : null}

        {state === "not-found" ? (
          <p className="text-muted-foreground">
            This medication isn&apos;t in the record anymore. It may have been
            renamed or deleted since I wrote that response.
          </p>
        ) : null}

        {state === "loaded" && preview ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium text-foreground">{preview.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {STATUS_LABEL[preview.status]}
              </span>
            </div>
            <p className="text-foreground">
              {preview.currentDose} · {preview.currentFrequency}
            </p>
            <Link
              href={`/patient/${preview.patientId}/medications/${preview.id}`}
              onClick={() => setOpen(false)}
              className="text-stone-700 underline-offset-4 hover:underline"
            >
              View full →
            </Link>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
