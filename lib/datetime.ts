/**
 * Date helpers per design.md 9.6:2805.
 *
 * date-fns (the doc-named library for date math) is intentionally not used
 * here. The four helpers below are 30-40 lines of plain `Intl` + arithmetic
 * with no surprising edge cases for the current display surfaces. When a sixth
 * or seventh consumer lands and we hit something genuinely awkward (timezone
 * arithmetic across DST in display logic, calendar-aware month math, etc.),
 * that's the right moment to revisit. Until then, no dep weight for one page.
 *
 * `todayInTimezone` operates in patient-tz (date-only DB columns).
 * The display helpers operate in browser-local — they're user-facing
 * ("6 days ago"), not data-write-facing.
 */

/**
 * Returns "today" as a YYYY-MM-DD string in the given IANA timezone.
 *
 * Per design.md 9.6:2803, date-only fields (started_on, discontinued_on, DOB,
 * etc.) should reflect the **patient's** local calendar date — not the user's
 * browser locale, and not UTC. A morning session in Pune logging an event for
 * "today" must store today's Pune date, not yesterday's UTC date.
 *
 * Uses `en-CA` locale because it emits ISO 8601 `YYYY-MM-DD` natively.
 */
export function todayInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Returns "Apr 30, 2026" in browser locale. Accepts a Date or a YYYY-MM-DD
 * string. Date-only strings are parsed as local calendar dates (not UTC) —
 * `new Date("2026-04-30")` interprets the string as UTC midnight, which can
 * shift the day in some browser timezones; constructing from components avoids
 * that.
 */
export function formatAbsoluteDate(d: Date | string): string {
  let date: Date;
  if (typeof d === "string") {
    const [y, m, day] = d.split("-").map(Number);
    date = new Date(y, m - 1, day);
  } else {
    date = d;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Returns a short relative description. Mixes short forms for sub-day units
 * ("5m ago", "3h ago") and long forms for day-and-up ("6 days ago",
 * "3 months ago") to match the §6.5 sample (`6 days ago · Apr 30, 2026`).
 *
 *   < 1 min            → "just now"
 *   < 1 hour           → "Nm ago"
 *   < 24 hours         → "Nh ago"
 *   same calendar day  → "today"
 *   previous day       → "yesterday"
 *   < 30 days          → "N days ago"
 *   < 12 months (~30d) → "N months ago"
 *   else               → "N years ago"
 *
 * Months/years are approximate (30/365 days). For clinical surfaces the
 * absolute date is always rendered alongside via `formatRelativeAndAbsolute`,
 * so the approximation never stands alone.
 *
 * Assumes `d <= now`. Future timestamps flatten to "today" — callers should
 * not pass scheduled/future dates without revisiting this contract.
 */
export function formatRelative(d: Date, now?: Date): string {
  const ref = now ?? new Date();
  const diffMs = ref.getTime() - d.getTime();

  if (diffMs < 60_000) return "just now";
  if (diffMs < 3_600_000) {
    const minutes = Math.floor(diffMs / 60_000);
    return `${minutes}m ago`;
  }
  if (diffMs < 86_400_000) {
    const hours = Math.floor(diffMs / 3_600_000);
    return `${hours}h ago`;
  }

  const dayDiff = Math.round(
    (startOfDay(ref).getTime() - startOfDay(d).getTime()) / 86_400_000,
  );

  if (dayDiff <= 0) return "today";
  if (dayDiff === 1) return "yesterday";
  if (dayDiff < 30) return `${dayDiff} days ago`;

  const months = Math.floor(dayDiff / 30);
  if (months < 12) {
    return `${months} ${months === 1 ? "month" : "months"} ago`;
  }
  const years = Math.floor(dayDiff / 365);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

export function formatRelativeAndAbsolute(d: Date, now?: Date): string {
  return `${formatRelative(d, now)} · ${formatAbsoluteDate(d)}`;
}

/**
 * Duration since a past date, for §6.5's long-running-relationship computation
 * ("first visit Mar 2018 · 8 years"). Whole units, approximate (30/365 days) —
 * same precision contract as formatRelative. Returns null when the span is
 * under a month (showing "0 months" next to a recent first-visit reads wrong)
 * or when the date is in the future.
 */
export function formatDurationSince(d: Date | string, now?: Date): string | null {
  let date: Date;
  if (typeof d === "string") {
    const [y, m, day] = d.split("-").map(Number);
    date = new Date(y, m - 1, day);
  } else {
    date = d;
  }
  const ref = now ?? new Date();
  const dayDiff = Math.floor(
    (startOfDay(ref).getTime() - startOfDay(date).getTime()) / 86_400_000,
  );
  if (dayDiff < 30) return null;
  const months = Math.floor(dayDiff / 30);
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"}`;
  const years = Math.floor(dayDiff / 365);
  return `${years} ${years === 1 ? "year" : "years"}`;
}
