"use client";

/**
 * Visual citation pill. Two variants — vault (`§ entity-type:slug`) and external
 * (`↗ source-name`) — distinguishable per design.md 6.2:1204-1205.
 *
 * Interactivity (Phase C item 7 + Phase D): vault `med`, `condition`, `doctor`,
 * `allergy`, `family-history`, `lifestyle`, `visit`, and `lab-report` pills are
 * clickable and open a popover with an entity preview + `View full →` link to
 * the entity detail page (6.2:1206, 6.2:1216). Remaining pills — vault entity
 * types whose detail pages don't exist yet (the other event entities), and
 * external citations — stay inert spans, because a popover would dead-end. As
 * more detail pages land, add an entry to INTERACTIVE_ENTITY_CONFIGS.
 *
 * `lifestyle` is the odd one out: the slug is the fixed `profile` (singleton,
 * serializers/lifestyle.ts), so its endpoint ignores the slug and hits the
 * profile GET directly.
 *
 * (The med/condition pill pair was folded into the single config-driven
 * component below when the 3rd interactive entity — doctor — arrived, per the
 * deferral noted in the Phase C/D handoffs.)
 *
 * Color: vault pills carry the periwinkle brand accent (the `--accent` tint with
 * `--accent-foreground` text); external `↗` pills stay neutral stone. The split is
 * semantic — a vault citation points inside the record (brand-tinted), an external
 * citation points outside it (neutral). Periwinkle locked 2026-05-31 (see
 * app/globals.css + decisions.md); supersedes the 2026-05-20 stone-only reset.
 */

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";

import {
  SEVERITY_OPTIONS as ALLERGY_SEVERITY_OPTIONS,
  STATUS_OPTIONS as ALLERGY_STATUS_OPTIONS,
  CATEGORY_OPTIONS as ALLERGY_CATEGORY_OPTIONS,
} from "@/components/allergies/allergy-options";
import { STATUS_OPTIONS } from "@/components/conditions/condition-options";
import { RELATION_LABEL } from "@/components/family-history/family-history-options";
import { trendValueLabel } from "@/components/lifestyle/lifestyle-options";
import {
  STATUS_LABEL as VISIT_STATUS_LABEL,
  VISIT_TYPE_LABEL,
} from "@/components/visits/visit-options";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { displayDoctorName } from "@/lib/doctor-display";

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

// Shared base styling so the interactive pills are visually identical to the
// inert spans — the popover affordance is the only difference.
const VAULT_PILL_CLASS =
  "inline-flex items-baseline rounded-full bg-accent px-2 py-0.5 font-mono text-[0.85em] text-accent-foreground ring-1 ring-accent-foreground/15";

/** What the popover renders once a preview resolves. */
interface EntityPreview {
  href: string;
  title: string;
  /** Right-aligned note on the title row — status label / specialty. */
  rightNote: string | null;
  /** Body lines below the title row. */
  lines: string[];
}

interface VaultEntityConfig {
  endpoint(slug: string): string;
  notFoundCopy: string;
  /** Maps the by-slug response body to the popover's render model. */
  extract(json: unknown): EntityPreview;
}

const MED_STATUS_LABEL: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  discontinued: "Discontinued",
};

// Derived from the single source in condition-options.ts. Safe to import even
// though this module loads early via chat-drawer-provider: condition-options
// imports @/db/schema as `import type`, so it carries no runtime DB edge.
const CONDITION_STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
);

// Same type-only-import safety as condition-options (see allergy-options.ts).
const ALLERGY_STATUS_LABEL: Record<string, string> = Object.fromEntries(
  ALLERGY_STATUS_OPTIONS.map((o) => [o.value, o.label]),
);
const ALLERGY_SEVERITY_LABEL: Record<string, string> = Object.fromEntries(
  ALLERGY_SEVERITY_OPTIONS.map((o) => [o.value, o.label]),
);
const ALLERGY_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  ALLERGY_CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
);

interface MedPreviewPayload {
  medication: {
    id: string;
    patientId: string;
    name: string;
    currentDose: string;
    currentFrequency: string;
    status: string;
    prescribedBy: { name: string; specialty: string } | null;
  };
}

interface ConditionPreviewPayload {
  condition: {
    id: string;
    patientId: string;
    name: string;
    status: string;
    severity: string | null;
  };
}

interface AllergyPreviewPayload {
  allergy: {
    id: string;
    patientId: string;
    substance: string;
    category: string;
    severity: string | null;
    status: string;
    reaction: string | null;
  };
}

interface DoctorPreviewPayload {
  doctor: {
    id: string;
    patientId: string;
    name: string;
    specialty: string;
    clinic: string | null;
  };
}

interface FamilyHistoryPreviewPayload {
  entry: {
    id: string;
    patientId: string;
    relation: string;
    relationSpecific: string | null;
    conditionName: string;
    ageOfOnset: number | null;
    outcome: string | null;
  };
}

interface VisitPreviewPayload {
  visit: {
    id: string;
    patientId: string;
    visitDate: string;
    visitType: string | null;
    status: string;
    chiefComplaint: string | null;
    summary: string | null;
    doctor: { name: string; specialty: string } | null;
  };
}

interface LifestylePreviewPayload {
  profile: {
    id: string;
    patientId: string;
    dietPattern: string | null;
    exercisePattern: string | null;
    sleepPattern: string | null;
    stressLevel: string | null;
  };
}

interface LabReportPreviewPayload {
  report: {
    id: string;
    patientId: string;
    reportDate: string;
    reportType: string | null;
    labName: string | null;
    markerCount: number;
    flaggedCount: number;
    orderingDoctor: { name: string; specialty: string } | null;
  };
}

const INTERACTIVE_ENTITY_CONFIGS: Record<string, VaultEntityConfig> = {
  med: {
    endpoint: (slug) => `/api/medications/by-slug/${encodeURIComponent(slug)}`,
    notFoundCopy:
      "This medication isn't in the record anymore. It may have been renamed or deleted since I wrote that response.",
    extract: (json) => {
      const { medication: m } = json as MedPreviewPayload;
      const lines = [`${m.currentDose} · ${m.currentFrequency}`];
      if (m.prescribedBy) {
        lines.push(
          `Prescribed by ${displayDoctorName(m.prescribedBy.name)} · ${m.prescribedBy.specialty}`,
        );
      }
      return {
        href: `/patient/${m.patientId}/medications/${m.id}`,
        title: m.name,
        rightNote: MED_STATUS_LABEL[m.status] ?? m.status,
        lines,
      };
    },
  },
  condition: {
    endpoint: (slug) => `/api/conditions/by-slug/${encodeURIComponent(slug)}`,
    notFoundCopy:
      "This condition isn't in the record anymore. It may have been renamed or deleted since I wrote that response.",
    extract: (json) => {
      const { condition: c } = json as ConditionPreviewPayload;
      return {
        href: `/patient/${c.patientId}/conditions/${c.id}`,
        title: c.name,
        rightNote: CONDITION_STATUS_LABEL[c.status] ?? c.status,
        lines: c.severity ? [c.severity] : [],
      };
    },
  },
  allergy: {
    endpoint: (slug) => `/api/allergies/by-slug/${encodeURIComponent(slug)}`,
    notFoundCopy:
      "This allergy isn't in the record anymore. It may have been renamed or removed since I wrote that response.",
    extract: (json) => {
      const { allergy: a } = json as AllergyPreviewPayload;
      const lines: string[] = [];
      const categoryLabel = ALLERGY_CATEGORY_LABEL[a.category] ?? a.category;
      // "unknown" severity is the default-when-absent (§4:261) — noise in a
      // 3-line preview, so only a meaningful severity renders.
      if (a.severity && a.severity !== "unknown") {
        lines.push(
          `${categoryLabel} · ${ALLERGY_SEVERITY_LABEL[a.severity] ?? a.severity}`,
        );
      } else {
        lines.push(categoryLabel);
      }
      if (a.reaction) lines.push(a.reaction);
      return {
        href: `/patient/${a.patientId}/allergies/${a.id}`,
        title: a.substance,
        rightNote: ALLERGY_STATUS_LABEL[a.status] ?? a.status,
        lines,
      };
    },
  },
  doctor: {
    endpoint: (slug) => `/api/doctors/by-slug/${encodeURIComponent(slug)}`,
    notFoundCopy:
      "This doctor isn't in the record anymore. They may have been renamed or removed since I wrote that response.",
    extract: (json) => {
      const { doctor: d } = json as DoctorPreviewPayload;
      return {
        href: `/patient/${d.patientId}/doctors/${d.id}`,
        title: displayDoctorName(d.name),
        rightNote: d.specialty,
        lines: d.clinic ? [d.clinic] : [],
      };
    },
  },
  "family-history": {
    endpoint: (slug) =>
      `/api/family-history/by-slug/${encodeURIComponent(slug)}`,
    notFoundCopy:
      "This family history entry isn't in the record anymore. It may have been edited or removed since I wrote that response.",
    extract: (json) => {
      const { entry: e } = json as FamilyHistoryPreviewPayload;
      const lines: string[] = [];
      if (e.ageOfOnset !== null) lines.push(`Onset around age ${e.ageOfOnset}`);
      if (e.outcome) lines.push(e.outcome);
      return {
        href: `/patient/${e.patientId}/family-history/${e.id}`,
        title: e.conditionName,
        rightNote:
          e.relationSpecific ?? RELATION_LABEL[e.relation] ?? e.relation,
        lines,
      };
    },
  },
  visit: {
    endpoint: (slug) => `/api/visits/by-slug/${encodeURIComponent(slug)}`,
    notFoundCopy:
      "This visit isn't in the record anymore. It may have been edited or removed since I wrote that response.",
    extract: (json) => {
      const { visit: v } = json as VisitPreviewPayload;
      const lines: string[] = [];
      const facts = [
        v.visitType ? (VISIT_TYPE_LABEL[v.visitType] ?? v.visitType) : null,
        v.status !== "completed"
          ? (VISIT_STATUS_LABEL[v.status] ?? v.status)
          : null,
      ].filter((f): f is string => f !== null);
      if (facts.length > 0) lines.push(facts.join(" · "));
      const narrative = v.chiefComplaint ?? v.summary;
      if (narrative) {
        lines.push(
          narrative.length > 90 ? `${narrative.slice(0, 87)}…` : narrative,
        );
      }
      return {
        href: `/patient/${v.patientId}/visits/${v.id}`,
        title: v.doctor
          ? `Visit · ${displayDoctorName(v.doctor.name)}`
          : "Visit",
        // The slug IS the ISO date — readable as-is, matching the §6.7 title's
        // date-identity for visits.
        rightNote: v.visitDate,
        lines,
      };
    },
  },
  "lab-report": {
    endpoint: (slug) =>
      `/api/lab-reports/by-slug/${encodeURIComponent(slug)}`,
    notFoundCopy:
      "This lab report isn't in the record anymore. It may have been edited or removed since I wrote that response.",
    extract: (json) => {
      const { report: r } = json as LabReportPreviewPayload;
      const lines: string[] = [];
      if (r.reportType && r.labName) lines.push(r.labName);
      if (r.orderingDoctor) {
        lines.push(
          `Ordered by ${displayDoctorName(r.orderingDoctor.name)} · ${r.orderingDoctor.specialty}`,
        );
      }
      lines.push(
        r.flaggedCount > 0
          ? `${r.markerCount} markers · ${r.flaggedCount} flagged`
          : `${r.markerCount} ${r.markerCount === 1 ? "marker" : "markers"}`,
      );
      return {
        href: `/patient/${r.patientId}/labs/${r.id}`,
        title: r.reportType ?? r.labName ?? "Lab report",
        // The slug IS the ISO report date — readable as-is, matching the §6.7
        // detail's date identity.
        rightNote: r.reportDate,
        lines,
      };
    },
  },
  lifestyle: {
    // Singleton — the slug is the fixed `profile`, so the endpoint ignores it.
    endpoint: () => "/api/lifestyle",
    notFoundCopy:
      "There's no lifestyle profile in the record yet. It may have been referenced before anything was filled in.",
    extract: (json) => {
      const { profile: p } = json as LifestylePreviewPayload;
      // A 3-line preview can't carry three narratives — show the first one or
      // two that exist, truncated.
      const lines = [p.dietPattern, p.exercisePattern, p.sleepPattern]
        .filter((v): v is string => v !== null)
        .slice(0, 2)
        .map((v) => (v.length > 90 ? `${v.slice(0, 87)}…` : v));
      return {
        href: `/patient/${p.patientId}/lifestyle`,
        title: "Lifestyle",
        rightNote: p.stressLevel
          ? `stress ${trendValueLabel("stressLevel", p.stressLevel).toLowerCase()}`
          : null,
        lines,
      };
    },
  },
};

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
  // `entityType`). Interactive types resolve their preview via a `by-slug`
  // route; the rest stay inert.
  const config = INTERACTIVE_ENTITY_CONFIGS[props.entityType];
  if (config && props.slug.length > 0) {
    return (
      <VaultEntityCitationPill
        entityType={props.entityType}
        slug={props.slug}
        config={config}
      >
        {props.children}
      </VaultEntityCitationPill>
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

type FetchState = "idle" | "loading" | "loaded" | "not-found" | "error";

function VaultEntityCitationPill({
  entityType,
  slug,
  config,
  children,
}: {
  entityType: string;
  slug: string;
  config: VaultEntityConfig;
  children: ReactNode;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<FetchState>("idle");
  const [preview, setPreview] = useState<EntityPreview | null>(null);
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
    fetch(config.endpoint(slug))
      .then(async (res) => {
        // 404 is a definitive answer (the entity isn't resolvable) — stay
        // guarded.
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
        setPreview(config.extract(await res.json()));
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
        data-entity-type={entityType}
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
          <p className="text-muted-foreground">{config.notFoundCopy}</p>
        ) : null}

        {state === "loaded" && preview ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium text-foreground">
                {preview.title}
              </span>
              {preview.rightNote ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {preview.rightNote}
                </span>
              ) : null}
            </div>
            {preview.lines.map((line) => (
              <p key={line} className="text-foreground">
                {line}
              </p>
            ))}
            <Link
              href={preview.href}
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
