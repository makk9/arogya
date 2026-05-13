# arogya — Decision Log

Append-only. One entry per significant decision. Never edit past entries — if a decision is reversed, add a new entry explaining why.

Format:
```
---
**Date:** YYYY-MM-DD
**Decision:** one-line summary
**Context:** why this came up
**Choice:** what was decided
**Alternatives considered:** what else was on the table
**Reasoning:** why this choice was made
```

---

**Date:** 2026-05-11
**Decision:** Use `docs/progress.md` + `docs/decisions.md` for session continuity rather than inline CLAUDE.md state
**Context:** Sessions will be heavy/context-loaded; need a way for fresh sessions to pick up exactly where previous left off without manual copy-paste
**Choice:** Two separate docs injected via `SessionStart` hook — `progress.md` for operational state (auto-injected), `decisions.md` as append-only archive (read on demand)
**Alternatives considered:** Single combined doc; inline state in CLAUDE.md; no structured approach
**Reasoning:** Separating operational state (changes frequently) from decision archive (append-only) keeps both docs useful. Auto-injection via `SessionStart` hook means zero manual effort for context continuity.

---

**Date:** 2026-05-11
**Decision:** Scaffold Phase A.1 with Next.js 16 + React 19 + Tailwind v4 + Drizzle (postgres-js) + Zod 4
**Context:** Phase A item 1 — project init per design doc Phase 9.1 and 10.2
**Choice:** `create-next-app@16.2.6` (TS strict, App Router, ESLint, Tailwind, no src/, `@/*` alias, `--disable-git`); Drizzle ORM with the `postgres` driver; Zod 4 for env validation; `lib/env.ts` fails loudly on missing required vars
**Alternatives considered:** Pin to Next 14 LTS (rejected — design doc says "14+"; landing on latest is fine and avoids upgrade work); `pg` driver instead of `postgres` (rejected — Drizzle docs prefer `postgres` for serverless); install all v1 deps upfront (rejected — defer per phase boundary, smaller surface for v1.5 version pinning)
**Reasoning:** Latest framework versions keep us aligned with current Next.js docs. Drizzle + `postgres` is the design-doc-recommended pair. Zod 4 has API tweaks vs. v3 but `safeParse`/`flatten` are unchanged; URL/min validators still apply. Tailwind v4 ships CSS-first config (no `tailwind.config.ts`) — this matches Phase 7's design-token-via-CSS direction. Deferred to later phases: shadcn/ui init + palette (Phase C, first component); `@supabase/supabase-js` (Phase A item 7); `@anthropic-ai/sdk` + `ai` (Phase B); `react-hook-form`, `date-fns` (Phase C); CI workflows (before first PR to main). Kept the auto-generated `AGENTS.md` (single-line Next 16 warning) — it complements CLAUDE.md without competing as source of truth.

---

**Date:** 2026-05-12
**Decision:** Use Supabase **Session pooler** URL for `DATABASE_URL` (not Direct connection or Transaction pooler) in v1 dev
**Context:** During Phase A.1 verification, the Direct connection host (`db.<project-ref>.supabase.co`) failed DNS lookup. Supabase has retired Direct connection on new projects; only the pooler endpoints resolve.
**Choice:** Session pooler URL — host `aws-0-<region>.pooler.supabase.com:5432`, username `postgres.<project-ref>` (note the dot). Same single URL serves Drizzle Kit migrations AND Next.js dev runtime.
**Alternatives considered:** Transaction pooler (port 6543) — rejected for v1 dev because it does not support prepared statements, which breaks Drizzle migrations. Maintaining two `DATABASE_URL`s (session for migrations, transaction for runtime) — rejected as premature; revisit when Vercel serverless deploy lands (v1.5 or production).
**Reasoning:** Session pooler is the only endpoint that (a) actually resolves and (b) supports both prepared statements (needed by `drizzle-kit migrate`) and ad-hoc queries (needed by app code). The transaction-pooler split becomes relevant only when running on Vercel Functions where connections need to be short-lived; v1 demo runs locally and on Vercel with sufficient pool capacity from the session endpoint. Worth re-evaluating before production deploy.

---

**Date:** 2026-05-12
**Decision:** Add `tsx` as dev dep; create `scripts/check-env.ts` + `scripts/check-db.ts` as repo utilities
**Context:** Needed a way to run TypeScript files (e.g. `lib/env.ts`) standalone to verify env validation and DB connectivity. Forward-compatible with design doc 9.5's `scripts/backup.ts` and Phase A item 5's seed script.
**Choice:** Install `tsx` (esbuild-based TS runner, no config required). Add two smoke-test scripts: `check-env.ts` (imports `lib/env`, exits if Zod validation fails) and `check-db.ts` (opens a `postgres` connection, runs `select 1`, reports server version). Both runnable via `npx tsx --env-file=.env.local scripts/<name>.ts`.
**Alternatives considered:** `ts-node` (older, slower, more config); compile to JS via `tsc` before running (verbose); skip helpers and rely on `next dev` smoke test (less direct, doesn't actually exercise env-importing code).
**Reasoning:** `tsx` is the modern default for TS scripts; near-zero cost to install and serves multiple later use cases. The two helpers are tiny (<20 lines each) and become load-bearing the next time env/DB config changes (e.g. swapping to Transaction pooler for production). Keeping them in-repo means smoke tests are reproducible across sessions and contributors.

---

**Date:** 2026-05-12
**Decision:** Lock Phase A item 2 schema with pgEnum for all enums, ABO/Rh values for `blood_type`, and `restrict` (not cascade) for required cross-entity FKs in clinical history
**Context:** Phase A item 2 (schema) had three tactical decisions not prescribed by design.md Phase 4 / 9.2: (1) how to implement enum columns, (2) what values to use for `blood_type` (Phase 4 says "enum" but doesn't enumerate), (3) `onDelete` policy on required FKs other than `patient_id` (where Phase 9.2 mandates cascade).
**Choice:** (1) Native Postgres `pgEnum` — true ENUM types, one declaration per enum, snake_case names. (2) `blood_type` values: standard ABO/Rh set (`A+ | A- | B+ | B- | AB+ | AB- | O+ | O-`). (3) Required cross-entity FKs in clinical records default to `onDelete: "restrict"`. In v1 only `visits.doctor_id` qualifies; pattern applies forward. Cascade reserved for `patient_id` (Phase 9.2 mandate) and parent-child pairs where the child has no independent meaning (change logs, `lab_results→lab_reports`, `symptom_episodes→symptom_types`, `extraction_sessions→reports`).
**Alternatives considered:** (1) `text` + CHECK constraint — easier to add/remove values via simple ALTER TABLE, but no automatic Drizzle TS union, more boilerplate. Rejected because pgEnum is cleaner and the cost of adding values later (`ALTER TYPE … ADD VALUE`) is acceptable. (2) Inline ABO/Rh values vs. broader set with "unknown" — went with the standard 8 since Phase 4 isn't prescriptive and ABO/Rh is the universal clinical set. (3) `cascade` on `visits.doctor_id` — rejected during /check review: a doctor row deletion would silently nuke a patient's entire visit history. UI should guide merge/reassign instead.
**Reasoning:** pgEnum aligns with Drizzle's recommended pattern for typed enums and gives free TS unions via `$inferSelect`. The ABO/Rh choice will appear in the patient form's blood-type dropdown — call out at UI build time if the patient population needs a broader set (e.g. include "unknown" or "Rh null"). The restrict-by-default FK policy is now a project-wide rule saved to memory (`feedback-fk-delete-behavior`); apply forward to any new required cross-entity FK.

---

**Date:** 2026-05-12
**Decision:** Include Phase 9.4 schema additions (extraction_sessions table, nullable `source_report_id` FK on 7 derivable entities, `reports.status` enum) in the Phase A item 2 migration
**Context:** Phase A item 2 per CLAUDE.md says "all 14 tables per Phase 4 + 9.2". But design.md Phase 10.2 line 2959 explicitly lists `extraction_sessions` as part of item 2, and line 3030 says "Schema with all 14 tables before any agent code". Phase 9.4 also mandates a nullable `source_report_id` FK on Medication, Condition, LabReport, VitalReading, SymptomEpisode, Visit, JournalEntry, plus a `reports.status` enum (`extracting | ready | failed | committed`). Question: do these ship now or during Phase E?
**Choice:** Ship now. Migration `0000_initial_schema.sql` includes the extraction_sessions table, all 7 `source_report_id` columns (nullable, FK→reports, ON DELETE SET NULL), and the `reports.status` enum with default `ready`.
**Alternatives considered:** Defer to Phase E and ship a follow-up migration when the file pipeline lands. Rejected because (a) Phase 10.2 explicitly puts this in item 2, (b) schema lockdown is in Phase A so adding columns later still requires a migration anyway, (c) zero runtime cost — nullable cols sit unused until extraction is wired up.
**Reasoning:** Schema is locked once `0000_initial_schema.sql` is applied to dev — every subsequent change is a new migration. Cleaner to land the full schema in one initial migration than to ship two. The `reports.status` default of `ready` ensures rows entered manually (i.e. not via extraction) start in the correct terminal state without requiring callers to set status. The `source_report_id` columns enable the extraction traceability requirement in 9.4 ("extraction source link persists on entity pages after commit") without needing schema changes during Phase E.

---

**Date:** 2026-05-12
**Decision:** Keep both `patients.family_history` (markdown column) AND the structured `family_history` table
**Context:** Phase 4 has both a free-text `family_history` column on patients (design.md:244) AND a structured `family_history` table (design.md:541). The column's note literally says "Promotes to a structured table in v2 if patterns emerge" — but the structured table is already in v1. The two surfaces overlap.
**Choice:** Keep both. The `patients.family_history` column holds narrative / cross-cutting prose ("paternal MI history at 65, maternal diabetes onset 50, etc."); the `family_history` table holds individual entries the AI can query per-relation. Doc note at design.md:244 is stale.
**Alternatives considered:** Drop the column and rely on the structured table's per-entry `notes` field for prose context. Rejected because the user wants a singleton narrative surface in addition to per-relation rows — useful for entries that don't fit any single relation cleanly.
**Reasoning:** Two surfaces, no overlap if used carefully: column = patient-level narrative summary, table = per-relation rows. Vault context serializer will need to include both when building synthesis context — flag for Phase B work. design.md:244 should be amended during a future doc cleanup pass.

---

**Date:** 2026-05-12
**Decision:** `updated_at` columns auto-update at the Drizzle ORM level (`$onUpdate(() => new Date())`), not via a database trigger
**Context:** Every table in the schema has `created_at` and `updated_at` columns per Phase 4 convention (line 219: "assume present on every table"). Postgres does not auto-update timestamps on UPDATE — the mechanism has to come from somewhere.
**Choice:** Drizzle's `.$onUpdate(() => new Date())` modifier. All `updated_at` columns get this treatment in every schema file.
**Alternatives considered:** Database trigger (PL/pgSQL function set in the migration). Rejected: more migration noise, harder to reason about test fixtures, and v1 has no use case where rows are updated outside Drizzle (no direct psql writes, no RLS, no other ORM).
**Reasoning:** App-level auto-update keeps the schema migration clean and matches Drizzle docs. Trade-off (worth knowing): direct SQL writes via psql, Drizzle Studio raw queries, or any future non-Drizzle client will NOT touch `updated_at`. Revisit in v1.5 if real auth + RLS + direct-from-Supabase reads land — at that point a trigger is the safer bet.

---

**Date:** 2026-05-12
**Decision:** Stub auth IDs are v4 UUID literals exported as shared constants from `lib/auth.ts`; seed imports them; return-object field names are `userId` / `patientId` (matching design doc 9.6:2737-2753 verbatim, not the ergonomic `id`)
**Context:** Phase A items 4 + 5. Design doc 9.6:2737-2753 shows stub return values like `userId: "user_demo_avi"`, `patientId: "patient_demo_ramesh"` — but `patients.id` is a `uuid` column in the locked schema, so the doc's snake_case string literals cannot satisfy the FK constraint. Separately, the seed and auth helpers both need the SAME fixed IDs forever, with no drift risk.
**Choice:** Generated two v4 UUIDs once, hardcoded as `STUB_USER_ID` / `STUB_PATIENT_ID` exports from `lib/auth.ts`. `db/seed.ts` imports both constants and uses them for the Ramesh INSERT (`patients.id = STUB_PATIENT_ID`, `patients.owner_user_id = STUB_USER_ID`). Return-object field names match the doc spec exactly: `getCurrentUser()` → `{ userId, name, email }`; `getCurrentPatient()` → `{ patientId, name }`. Email value `avi@arogya.local` (`.local` TLD signals stub data).
**Alternatives considered:** (a) doc's snake_case string IDs — rejected (schema requires uuid). (b) duplicate UUID literals in both `lib/auth.ts` and `db/seed.ts` — rejected (drift risk). (c) `id` field names on return objects — initially shipped; /check caught the deviation against 9.6:2737-2753 and we renamed. (d) Deterministic UUIDs via `uuidv5` — over-clever; the values aren't meaningful, only stable.
**Reasoning:** Co-locating the constants with the auth helpers is the natural single-source-of-truth pattern — rename or rotate in one place. Matching the doc's field names exactly (even though `id` would be ergonomically cleaner at call sites like `db.select().where(eq(patients.id, patient.id))`) keeps call sites aligned with the spec, so the v1.5 swap to real auth replaces only the helper bodies. Future call sites MUST read `user.userId` and `patient.patientId`, never `.id`.

---

**Date:** 2026-05-12
**Decision:** `lib/storage.ts` uses `import "server-only"`; `scripts/setup-storage.ts` therefore cannot import `STORAGE_BUCKET` and inlines `"arogya"` with a cross-reference comment
**Context:** Phase A item 7. `lib/storage.ts` uses `supabaseAdmin` (service-role key) — must never bundle into client code. The bucket-creation script needs the same bucket name. Next 16 does not ship `server-only` transitively, so it was installed as a dep.
**Choice:** `import "server-only"` at the top of `lib/storage.ts` as a build-time guard against client-bundle inclusion. `scripts/setup-storage.ts` runs via tsx (not in a Next bundle) — `server-only` throws at runtime in that context, so the script cannot import anything from `lib/storage.ts`. Setup script declares `const BUCKET = "arogya"` locally with a comment cross-referencing `STORAGE_BUCKET` in `lib/storage.ts`. Path builders dropped from `lib/storage.ts` for now (Phase 9.4:2612 only names the three I/O helpers; first caller is Phase E `/api/files/sign`).
**Alternatives considered:** (a) hoist bucket name into its own file (e.g. `lib/storage-bucket.ts`) that both `lib/storage.ts` and the setup script import — rejected as over-modular for one string. (b) drop the `server-only` guard — rejected; credential-protection guarantee is worth a tiny duplication. (c) include path builders (`storagePaths.upload(patientId, filename)` etc.) — rejected per CLAUDE.md "don't pre-build"; design doc enumerates path patterns but its helpers list (line 2612) does not include path builders, and committing to a shape before the first caller exists locks in drift.
**Reasoning:** `server-only`'s runtime-throw behavior is intentional — respecting it means accepting one string duplication, made explicit and grep-able via the cross-reference comment. Path builders get added when `/api/files/sign` lands in Phase E and the exact upload-flow shape is known. Bucket-level RLS deferred to v1.5 per design doc 9.4:2546.

---

**Date:** 2026-05-12
**Decision:** Phase A query helpers ship a minimal first cut — `forPatient(patientId)` per entity plus `active(patientId)` only for medications + conditions; exported as per-entity namespace objects; change-log and specialized helpers deferred until a UI surface needs them
**Context:** Phase A item 6. Phase 9.2:2313-2322 prescribes `db/queries/` with per-entity helpers taking `patientId` as an explicit param (RLS-ready); gives `medications.ts (forPatient, active, ...)` as the only concrete example. Open questions: how broad should the first cut be (the indexing strategy at 9.2:2297-2306 implies several access patterns), and how should the helpers be exported?
**Choice:** 14 files in `db/queries/` mirroring `db/schema/` — singular file naming, matching the existing schema convention (design doc 9.2:2316-2319 example uses plural; doc is internally inconsistent with its own singular schema list). Each file exports a typed namespace object (`patientQueries`, `medicationQueries`, …) so the barrel `db/queries/index.ts` is collision-free even when multiple entities have a same-named helper (`active()` on both medications and conditions). Coverage shipped: `forPatient(patientId)` on every entity (or `getById` for the patient root, `getForPatient` for the lifestyle singleton, `forReport`/`forPatient` paired for lab + symptom child entities), plus `active(patientId)` for medications and conditions (the two cases the design doc explicitly cites). Helpers are async, return resolved row arrays from `db.select().from(...).where(eq(..., patientId))` SQL-style queries.
**Alternatives considered:** (a) build the full set the indexing strategy implies (recent-by-type for vitals, date-windowed for episodes, change-log `forParent(parentId)`, child-by-parent for `lab_results.lab_report_id`) — rejected per CLAUDE.md "don't pre-build for hypothetical requirements"; add when the first caller lands. (b) flat per-file function exports (`listMedicationsForPatient`) — rejected, less ergonomic at call sites and risks barrel collisions. (c) Drizzle relational query API (`db.query.medications.findMany(...)`) — rejected; SQL-style is more explicit about which columns and joins are involved, and matches most Drizzle examples in circulation.
**Reasoning:** Query helpers exist to compress the common patient-scoped read at call sites AND to be the seam for v1.5 RLS — taking `patientId` as an explicit parameter today means flipping on RLS later doesn't change any signatures. Building only what callers actually need (and what the design doc cites by name) keeps the surface honest. The namespace-object export style gives autocomplete and a stable barrel as new helpers get added. Change-log and specialized helpers get added when their UI surface lands in Phase D (medication/condition detail pages).
