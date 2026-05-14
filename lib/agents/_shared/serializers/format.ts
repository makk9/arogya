export type SlugIndex = Map<string, string>;

export function slugify(s: string): string {
  const slug = s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "unknown";
}

export function formatISODate(
  value: string | Date | null | undefined,
): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    return value.length >= 10 ? value.slice(0, 10) : value;
  }
  return value.toISOString().slice(0, 10);
}

export function formatISOTimestamp(
  value: Date | string | null | undefined,
): string | null {
  if (value == null) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString();
}

export function computeAge(
  dob: string | Date,
  now: Date,
): number {
  const dobStr =
    typeof dob === "string" ? dob.slice(0, 10) : dob.toISOString().slice(0, 10);
  const [y, m, d] = dobStr.split("-").map(Number);
  const nowStr = now.toISOString().slice(0, 10);
  const [ny, nm, nd] = nowStr.split("-").map(Number);
  let age = ny - y;
  if (nm < m || (nm === m && nd < d)) age -= 1;
  return age;
}

export function compareById(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// Tiebreaker-aware sort that does NOT mutate the input array.
export function sortStable<T extends { id: string }>(
  rows: readonly T[],
  primary: (r: T) => number,
): T[] {
  return [...rows].sort((a, b) => {
    const p = primary(a) - primary(b);
    if (p !== 0) return p;
    return compareById(a, b);
  });
}

// Resolves an entity reference via the slug index. Returns a "§ entity-type:slug"
// pill when the id is found, or a fallback raw-id pill when it isn't.
export function citationFor(
  id: string | null | undefined,
  slugIndex: SlugIndex,
): string | null {
  if (id == null) return null;
  const slug = slugIndex.get(id);
  if (slug) return `§ ${slug}`;
  return `§ unresolved:${id}`;
}
