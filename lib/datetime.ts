/**
 * Date helpers per design.md 9.6:2805. Phase C item 2 seeds this file with the
 * one helper currently needed across multiple call sites; `formatDate`,
 * `formatRelative`, `formatBoth` per the spec roadmap land when display
 * surfaces start formatting timestamps.
 *
 * date-fns (the doc-named library for date math) is intentionally not used
 * here: `todayInTimezone` is one line of `Intl.DateTimeFormat`, which is a
 * built-in and produces the same YYYY-MM-DD output natively. Adding a
 * dependency for one helper isn't worth the bundle weight. When the
 * display-side formatters land, that's the right moment to add date-fns.
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
