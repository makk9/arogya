"use client";

/**
 * Visual citation pill. Two variants — vault (`§ entity-type:slug`) and external
 * (`↗ source-name`) — distinguishable per design.md 6.2:1204-1205.
 *
 * Interactivity (Phase C item 7 + Phase D): vault `med` and `condition` pills are
 * clickable and open a popover with an entity preview + `View full →` link to the
 * entity detail page (6.2:1206, 6.2:1216). Remaining pills — other vault entity
 * types whose detail pages don't exist yet, and external citations — stay inert
 * spans, because a popover would dead-end. As more detail pages land, extend the
 * interactive branch. (When the 3rd interactive entity arrives, fold the two
 * near-identical *CitationPill components into one config-driven component.)
 *
 * Color: vault pills carry the periwinkle brand accent (the `--accent` tint with
 * `--accent-foreground` text); external `↗` pills stay neutral stone. The split is
 * semantic — a vault citation points inside the record (brand-tinted), an external
 * citation points outside it (neutral). Periwinkle locked 2026-05-31 (see
 * app/globals.css + decisions.md); supersedes the 2026-05-20 stone-only reset.
 */

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";

import { STATUS_OPTIONS } from "@/components/conditions/condition-options";
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
  "inline-flex items-baseline rounded-full bg-accent px-2 py-0.5 font-mono text-[0.85em] text-accent-foreground ring-1 ring-accent-foreground/15";

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

  // `slug` is the bare slug (the parser strips the `<type>:` prefix into
  // `entityType`). Interactive types resolve their preview via a `by-slug` route.
  if (props.entityType === "med" && props.slug.length > 0) {
    return (
      <MedCitationPill slug={props.slug}>{props.children}</MedCitationPill>
    );
  }
  if (props.entityType === "condition" && props.slug.length > 0) {
    return (
      <ConditionCitationPill slug={props.slug}>
        {props.children}
      </ConditionCitationPill>
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
        className={`${VAULT_PILL_CLASS} cursor-pointer transition-colors hover:ring-accent-foreground/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}
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
              className="text-link underline-offset-4 hover:underline"
            >
              View full →
            </Link>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

interface ConditionPreview {
  id: string;
  patientId: string;
  name: string;
  status: string;
  severity: string | null;
  category: string | null;
}

// Derived from the single source in condition-options.ts. Safe to import even
// though this module loads early via chat-drawer-provider: condition-options now
// imports @/db/schema as `import type`, so it carries no runtime DB edge and
// can't trigger a temporal-dead-zone here.
const CONDITION_STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
);

// Sibling of MedCitationPill (same fetch-on-open + retry-guard shape) for
// `§ condition:<slug>` pills. Resolves via /api/conditions/by-slug/[slug].
// Folding these two into one config-driven component is deferred to the 3rd
// interactive entity type.
function ConditionCitationPill({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<FetchState>("idle");
  const [preview, setPreview] = useState<ConditionPreview | null>(null);
  const requestedRef = useRef(false);

  function handleOpenChange(next: boolean): void {
    setOpen(next);
    if (!next || requestedRef.current) return;
    requestedRef.current = true;
    setState("loading");
    fetch(`/api/conditions/by-slug/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (res.status === 404) {
          setState("not-found");
          return;
        }
        if (!res.ok) {
          setState("error");
          requestedRef.current = false;
          return;
        }
        const json: { condition: ConditionPreview } = await res.json();
        setPreview(json.condition);
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
        data-entity-type="condition"
        data-slug={slug}
        className={`${VAULT_PILL_CLASS} cursor-pointer transition-colors hover:ring-accent-foreground/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}
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
            This condition isn&apos;t in the record anymore. It may have been
            renamed or deleted since I wrote that response.
          </p>
        ) : null}

        {state === "loaded" && preview ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium text-foreground">
                {preview.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {CONDITION_STATUS_LABEL[preview.status] ?? preview.status}
              </span>
            </div>
            {preview.severity ? (
              <p className="text-foreground">{preview.severity}</p>
            ) : null}
            <Link
              href={`/patient/${preview.patientId}/conditions/${preview.id}`}
              onClick={() => setOpen(false)}
              className="text-link underline-offset-4 hover:underline"
            >
              View full →
            </Link>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
