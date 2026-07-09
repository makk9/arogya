import type { CommitEntityType } from "@/lib/schemas/api/extract-commit";

/**
 * Hand-off bridge for §6.11's "Edit manually instead" — when the agent got
 * enough wrong that fixing inline is worse than starting fresh, the confirmation
 * card stashes its extracted values here and routes to the §6.12 structured form
 * for that entity type. The form reads the draft on mount, prefills, and clears
 * it (single-use — a later blank "+ Add" must not resurrect a stale draft).
 *
 * sessionStorage (not a query param) keeps the possibly-large, possibly-PHI
 * payload out of the URL/history and scoped to the tab. Keys are namespaced by
 * entity type so two hand-offs of different types don't collide.
 *
 * Values keep the extraction agent's snake_case field names (§5.4:763); each
 * form maps them to its own field shape on read.
 */

const KEY_PREFIX = "arogya:extract-draft:";

export type ExtractionDraft = Record<string, unknown>;

// Short-lived per-type memo of the consumed draft. `takeExtractionDraft` clears
// sessionStorage on read (single-use), which makes a raw read unsafe in a
// `useState` initializer: React StrictMode double-invokes initializers in dev, so
// the first call reads the draft and the second gets null. StrictMode's two
// invocations are synchronous within one mount, so we cache the value and drop it
// on the next tick — the paired invocation reuses it, but a *later* navigation to
// the same form (a genuine second mount) reads null instead of re-consuming a
// stale draft. Also cleared eagerly when a fresh draft is written.
const draftCache = new Map<CommitEntityType, ExtractionDraft | null>();

function key(type: CommitEntityType): string {
  return `${KEY_PREFIX}${type}`;
}

export function writeExtractionDraft(
  type: CommitEntityType,
  data: ExtractionDraft,
): void {
  if (typeof window === "undefined") return;
  draftCache.delete(type); // a new hand-off supersedes any memoized read
  try {
    window.sessionStorage.setItem(key(type), JSON.stringify(data));
  } catch {
    // Storage full / disabled — the form just opens blank. Non-fatal.
  }
}

// --- coercion helpers for form consumers -----------------------------------
// The draft carries the extraction agent's snake_case string values (§5.4:763).
// Forms apply a field only when it's present and valid, so a partial/garbled
// extraction still opens a usable form. Enum fields are dropped unless they
// match a known value — never guessed (mirrors the commit mapper's discipline).

export function draftString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

export function draftEnum<T extends string>(
  v: unknown,
  allowed: readonly T[],
): T | undefined {
  const s = draftString(v);
  if (s === undefined) return undefined;
  const normalized = s.toLowerCase().replace(/\s+/g, "_");
  return allowed.find((a) => a === s || a === normalized);
}

export function draftDate(v: unknown): string | undefined {
  const s = draftString(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
}

/**
 * Reads and CLEARS the draft (single-use). Returns null when absent/corrupt.
 * Idempotent per page-load via `draftCache` — safe to call from a `useState`
 * initializer despite StrictMode's double-invoke (see the cache note above).
 */
export function takeExtractionDraft(
  type: CommitEntityType,
): ExtractionDraft | null {
  if (typeof window === "undefined") return null;
  if (draftCache.has(type)) return draftCache.get(type) ?? null;

  let result: ExtractionDraft | null = null;
  try {
    const raw = window.sessionStorage.getItem(key(type));
    if (raw !== null) {
      window.sessionStorage.removeItem(key(type));
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        result = parsed as ExtractionDraft;
      }
    }
  } catch {
    result = null;
  }
  draftCache.set(type, result);
  // Survive StrictMode's synchronous second invocation, then forget — so a later
  // mount (a fresh "+ Add" navigation) doesn't re-serve this consumed draft.
  window.setTimeout(() => draftCache.delete(type), 0);
  return result;
}
