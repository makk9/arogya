import { z } from "zod";

/**
 * Typed surface reference — how the client tells /api/chat where the user is
 * (§5.3 surface context). The wire carries a key (+ entity id where the surface
 * is a detail page), never prose: the route resolves the ref server-side
 * (lib/chat/resolve-surface-context.ts) into the builder strings in
 * lib/chat/surface-context.ts, scope-checking any id against the current
 * patient first. Free text here would be a prompt-injection channel into the
 * system-side `<surface_context>` block, which the model treats with more
 * authority than a user message (decisions.md 2026-08-14).
 *
 * Client-safe: types + Zod only, no DB imports.
 */

// Surfaces identified by the key alone — lists, singletons, the dashboard.
export const PAGE_SURFACE_KEYS = [
  "dashboard",
  "patient-profile",
  "vitals-history",
  "lifestyle",
  "medications-list",
  "conditions-list",
  "doctors-list",
  "allergies-list",
  "family-history-list",
  "visits-list",
  "labs-list",
  "symptoms-list",
  "reports-list",
  "journal-list",
  "insights-list",
] as const;

// Detail surfaces — the ref must carry the entity's id, which the resolver
// verifies belongs to the current patient before building the string.
export const ENTITY_SURFACE_KEYS = [
  "medication",
  "condition",
  "allergy",
  "doctor",
  "insight",
  "symptom-type",
  "symptom-episode",
  "lab-report",
  "visit",
  "report",
  "journal-entry",
  "family-history-entry",
] as const;

// Entity variant first: a bare `{ key: "medication" }` must fail on the missing
// id, and `.strict()` on both keeps stray extra fields (e.g. an id on a page
// key) from slipping through the union.
export const surfaceRefSchema = z.union([
  z.object({ key: z.enum(ENTITY_SURFACE_KEYS), id: z.string().uuid() }).strict(),
  z.object({ key: z.enum(PAGE_SURFACE_KEYS) }).strict(),
]);

export type SurfaceRef = z.infer<typeof surfaceRefSchema>;
