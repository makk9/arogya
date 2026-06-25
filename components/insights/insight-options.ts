// Type-only import — the enums are used solely in `typeof X.enumValues`
// positions, never at runtime — so the DB layer stays out of the client bundle
// (same posture as condition-options.ts).
import type {
  insightCategory,
  insightSeverity,
  insightStatus,
} from "@/db/schema";

/**
 * Shared label maps + ordering for the Insight enums (§4 Insight). Single source
 * of truth across the feed (§6.8) and detail (§6.9) surfaces — card pills,
 * filter menus, and section headers all read from here.
 */

export const CATEGORY_OPTIONS: ReadonlyArray<{
  value: (typeof insightCategory.enumValues)[number];
  label: string;
}> = [
  { value: "pattern", label: "Pattern" },
  { value: "risk", label: "Risk" },
  { value: "gap", label: "Gap" },
  { value: "interaction", label: "Interaction" },
  { value: "trend", label: "Trend" },
  { value: "improvement", label: "Improvement" },
];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
);

export const SEVERITY_LABEL: Record<string, string> = {
  informational: "Informational",
  watch: "Watch",
  attention: "Attention",
  urgent: "Urgent",
};

/**
 * Severity → card-left-edge dot treatment (§6.8:1566/1581). Only the two highest
 * severities carry a filled dot; watch / informational render no dot (the
 * anti-alarm-fatigue principle, §5.6). `tokenClass` references semantic tokens
 * only — `destructive` (desaturated red) and `warning` (amber, hue 68), both
 * pre-defined in globals.css — so the palette stays a one-place swap.
 */
export const SEVERITY_DOT: Record<
  (typeof insightSeverity.enumValues)[number],
  { tokenClass: string; label: string } | null
> = {
  urgent: { tokenClass: "bg-destructive", label: "Urgent" },
  attention: { tokenClass: "bg-warning", label: "Attention" },
  watch: null,
  informational: null,
};

/**
 * Feed grouping is by **status** (§6.8:1563), newest-actionable first. Display
 * uses the locked schema status enum (§4:583: new / seen / acknowledged /
 * dismissed / acted_on). NEW + SEEN expand by default; the resolved trio
 * (ACKNOWLEDGED / ACTED ON / DISMISSED) collapse.
 *
 * NOTE — spec deviation: §6.8:1563's prose names the expanded groups "NEW and
 * WATCH". `watch` is a *severity* in the locked Phase 4 schema, not a status, so
 * there is no WATCH status bucket to render. Read as a wireframe-era label; the
 * schema-faithful grouping expands NEW + SEEN. Flagged for sign-off.
 */
export const STATUS_GROUPS: ReadonlyArray<{
  value: (typeof insightStatus.enumValues)[number];
  /** Section header (rendered uppercase via CSS). */
  label: string;
  /** Slug for the subtitle breakdown ("3 new · 1 acknowledged"). */
  word: string;
  slug: string;
  defaultOpen: boolean;
}> = [
  { value: "new", label: "New", word: "new", slug: "new", defaultOpen: true },
  { value: "seen", label: "Seen", word: "seen", slug: "seen", defaultOpen: true },
  {
    value: "acknowledged",
    label: "Acknowledged",
    word: "acknowledged",
    slug: "acknowledged",
    defaultOpen: false,
  },
  {
    value: "acted_on",
    label: "Acted on",
    word: "acted on",
    slug: "acted-on",
    defaultOpen: false,
  },
  {
    value: "dismissed",
    label: "Dismissed",
    word: "dismissed",
    slug: "dismissed",
    defaultOpen: false,
  },
];

export const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_GROUPS.map((g) => [g.value, g.label]),
);
