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
