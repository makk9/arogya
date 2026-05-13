# arogya — Session Context

> Loaded automatically at every session start. Update with `/handoff` before ending a session.
> Full decision log: `docs/decisions.md`

---

## Current Phase: A complete → Phase B starting

### Phase A Checklist (complete)
- [x] 1. Project init — Next.js 16 App Router, TS strict, Tailwind v4, Drizzle (postgres-js), Zod-validated `lib/env.ts`. shadcn/ui init deferred to Phase C.
- [x] 2. DB schema — 15 files in `db/schema/` (14 entities + extraction-session), barrel-exported.
- [x] 3. Initial migration — `0000_initial_schema.sql` applied to `arogya-dev` (22 tables, 34 enums, 46 FKs, 41 indexes).
- [x] 4. Stub auth — `lib/auth.ts` exports `STUB_USER_ID` / `STUB_PATIENT_ID` (v4 UUID literals) plus async `getCurrentUser()` returning `{ userId, name, email }` and `getCurrentPatient()` returning `{ patientId, name }` per Phase 9.6:2737-2753.
- [x] 5. Seed — `db/seed.ts` inserts Ramesh identity row (UUID via `STUB_PATIENT_ID`, `ownerUserId = STUB_USER_ID`, no medical data); idempotent via `onConflictDoNothing`. Script: `npm run db:seed`.
- [x] 6. Query helpers — 14 per-entity files in `db/queries/` + barrel; typed namespace objects; `forPatient(patientId)` on every entity, `active(patientId)` for medications + conditions.
- [x] 7. Supabase Storage — private `arogya` bucket created in `arogya-dev`; `lib/storage.ts` exports `uploadFile`, `getSignedUrl` (3600s default), `deleteFile`. Setup script: `npm run storage:setup`.

### Last Session
- 2026-05-12 (cont.) — closed Phase A. Shipped `lib/auth.ts`, `db/seed.ts`, `db/queries/*` (14 files + barrel), `lib/storage.ts` + `scripts/setup-storage.ts`. `arogya` bucket created private. Added `server-only` dep, `db:seed` + `storage:setup` npm scripts. `tsc --noEmit` clean.
- **Stub auth deviation caught by /check:** initially shipped `lib/auth.ts` returning `{ id, ... }` — design doc 9.6:2737-2753 prescribes `userId` / `patientId`. Fixed. Future call sites must read `user.userId` and `patient.patientId`, never `.id`.
- **Stub IDs are v4 UUIDs**, not the doc's `"user_demo_avi"` snake_case strings — `patients.id` is `uuid` in the locked schema, so the doc literal cannot satisfy the FK. Decision logged.
- **`server-only` quirk:** Next 16 doesn't ship the package transitively; installed explicitly. It throws at runtime when imported outside Next bundling, so `scripts/setup-storage.ts` cannot import `STORAGE_BUCKET` from `lib/storage.ts` — inlines `"arogya"` literal with a cross-reference comment. Acceptable; the guard's credential-protection guarantee is worth the duplication.
- **Query helpers deliberately minimal:** only `forPatient` + `active()` (for medications/conditions) shipped. Change-log `forParent(id)`, recent-by-type, date-windowed helpers all deferred until a UI surface needs them.

### Next Steps
1. **Phase B item 1 — vault context builder.** `lib/agents/_shared/vault-context.ts` per design doc 9.3. Most architecturally critical piece in Phase B; every agent depends on it. Must include the brief-exclusion default-true flag per CLAUDE.md tripwires. Install `@anthropic-ai/sdk` first (per Phase A decisions.md 2026-05-11 entry — deferred to Phase B).
2. **Phase B item 2 — per-entity vault serializers.** `lib/agents/_shared/serializers/` directory, one fn per entity rendering vault content in the `§ entity-type:id` citation-friendly format. Tight coupling with #1 — design together.
3. **Phase B items 3-4 together — agent error types + Zod output schemas.** `lib/agents/_shared/errors.ts` + `lib/agents/_shared/schemas.ts`. Small infrastructure files; build before the first agent (synthesis, item 5) so it has the shared scaffolding ready.

### Open Questions / Blockers
*(none)*

---
*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*
