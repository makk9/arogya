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
 * Per design.md §4:243 (Patient.timezone — "All timestamps interpret here")
 * + §6.12:1842, date-only fields (started_on, discontinued_on, DOB,
 * etc.) should reflect the **patient's** local calendar date — not the user's
 * browser locale, and not UTC. A morning session in Pune logging an event for
 * "today" must store today's Pune date, not yesterday's UTC date.
 *
 * Uses `en-CA` locale because it emits ISO 8601 `YYYY-MM-DD` natively.
 */
export function todayInTimezone(timezone: string): string {
  return dateInTimezone(new Date(), timezone);
}

/** A Date's calendar date as YYYY-MM-DD in the given IANA timezone. */
export function dateInTimezone(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Returns "today" as YYYY-MM-DD in the runtime's local timezone — in a client
 * component, the browser's (i.e. the *user's*) timezone.
 *
 * Used for form date *defaults* (Started on, Changed on). This deliberately
 * deviates from §6.12:1842's "default today in patient timezone" (and the
 * §4:243 interpretive note) — though it ALIGNS with §9.6's display rule
 * ("convert to user's local timezone"): an evening session in
 * the US was defaulting "Changed on" to tomorrow's Pune date, which read as
 * wrong to the person filling the form (user decision, 2026-06-10 —
 * decisions.md). The user can still backdate via the picker;
 * `todayInTimezone` remains for any future patient-clock semantics.
 */
export function todayLocal(): string {
  return new Intl.DateTimeFormat("en-CA", {
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
 * Relative description at DAY granularity, for date-only values (visit_date,
 * started_on, etc.) that carry no time-of-day. Unlike formatRelative, it never
 * emits sub-day units: a calendar date anchored to local midnight would read as
 * "20h ago" for anything dated earlier the same day, even though the user only
 * picked a date — so a visit logged today must say "today", not "20h ago".
 * Symmetric for future dates (scheduled visits).
 *
 *   today              → "today"
 *   yesterday/tomorrow → "yesterday" / "tomorrow"
 *   < 30 days          → "N days ago"   | "in N days"
 *   < 12 months (~30d) → "N months ago" | "in N months"
 *   else               → "N years ago"  | "in N years"
 *
 * Accepts a `YYYY-MM-DD` string (parsed as a local calendar date) or a Date
 * (its local Y/M/D is used). Months/years approximate (30/365), same precision
 * contract as formatRelative.
 */
export function formatRelativeDate(d: Date | string, now?: Date): string {
  let date: Date;
  if (typeof d === "string") {
    const [y, m, day] = d.split("-").map(Number);
    date = new Date(y, m - 1, day);
  } else {
    date = d;
  }
  const ref = now ?? new Date();
  const dayDiff = Math.round(
    (startOfDay(date).getTime() - startOfDay(ref).getTime()) / 86_400_000,
  );

  if (dayDiff === 0) return "today";
  if (dayDiff === 1) return "tomorrow";
  if (dayDiff === -1) return "yesterday";

  const abs = Math.abs(dayDiff);
  const phrase = (n: number, unit: string) =>
    dayDiff > 0 ? `in ${n} ${unit}` : `${n} ${unit} ago`;

  if (abs < 30) return phrase(abs, abs === 1 ? "day" : "days");
  const months = Math.floor(abs / 30);
  if (months < 12) return phrase(months, months === 1 ? "month" : "months");
  const years = Math.floor(abs / 365);
  return phrase(years, years === 1 ? "year" : "years");
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

/**
 * Whole-year age from a YYYY-MM-DD date of birth — calendar-correct (decrements
 * if this year's birthday hasn't passed yet), not the 365-day approximation the
 * relative-time helpers use, since a displayed age must match what a person
 * would say. Drives the patient-profile subtitle (design.md 6.10:1671).
 *
 * `today` is the reference calendar date as a YYYY-MM-DD string — pass the
 * patient's local today (`todayInTimezone`) so the age flips on the patient's
 * birthday, not the server's. Omitted → the runtime's local date. Returns null
 * for a future DOB.
 */
export function ageInYears(dob: string, today?: string): number | null {
  const [y, m, d] = dob.split("-").map(Number);
  let ry: number;
  let rm: number;
  let rd: number;
  if (today) {
    [ry, rm, rd] = today.split("-").map(Number);
  } else {
    const ref = new Date();
    ry = ref.getFullYear();
    rm = ref.getMonth() + 1;
    rd = ref.getDate();
  }
  let age = ry - y;
  if (rm < m || (rm === m && rd < d)) age -= 1;
  return age < 0 ? null : age;
}
