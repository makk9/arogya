# arogya — Session Context

> Loaded automatically at every session start. Update with `/handoff` before ending a session.
> Full decision log: `docs/decisions.md`

---

## Current Phase: A — Foundation

### Phase A Checklist
- [x] 1. Project init — Next.js 16 App Router, TS strict, Tailwind v4, Drizzle (postgres-js), Zod-validated `lib/env.ts`. shadcn/ui init deferred to Phase C (first component).
- [ ] 2. DB schema — all 14 tables in `db/schema/`, barrel-exported via `db/schema/index.ts`
- [ ] 3. Initial migration — generated + applied to `arogya-dev` Supabase
- [ ] 4. Stub auth — `lib/auth.ts` exports `getCurrentUser()` + `getCurrentPatient()` (hardcoded)
- [ ] 5. Seed — Avi (user) + Ramesh (patient), identity only, no medical data
- [ ] 6. Query helpers — per-entity files in `db/queries/`
- [ ] 7. Supabase Storage — `arogya` bucket, patient-namespaced paths in `lib/storage.ts`

### Last Session
- 2026-05-12 — verified Phase A item 1 end-to-end. `.env.local` populated with real `arogya-dev` Supabase creds + Anthropic API key.
- Installed `tsx` as dev dep for running `.ts` scripts (will also serve later seed/backup scripts per design doc 9.5).
- Added `scripts/check-env.ts` and `scripts/check-db.ts` as repo utilities for env-schema + live-DB smoke tests. Run with `npx tsx --env-file=.env.local scripts/<name>.ts`.
- **Gotcha for v1.5 deployment:** Supabase has retired the "Direct connection" host (`db.<ref>.supabase.co`) for new projects — DNS does not resolve. Use the **Session pooler** URL (`aws-0-<region>.pooler.supabase.com:5432`, username `postgres.<project-ref>`) for `DATABASE_URL`. Drizzle migrations + dev runtime both work on session pooler. Transaction pooler (port 6543) reserved for serverless runtime later (no prepared-statement support).
- Connection verified: Postgres 17.6 reachable. Env schema parses cleanly.

### Next Steps
1. Phase A item 2 — write all 14 schema files in `db/schema/`, barrel-export via `db/schema/index.ts`. Read design doc Phase 4 + 9.2 end-to-end first; start with `/plan` since schema is locked once migrated.
2. Phase A item 3 — `npm run db:generate` then `npm run db:migrate` to apply to `arogya-dev`.
3. Phase A item 4 — stub `lib/auth.ts` (hardcoded Avi + Ramesh) per design doc 9.6.

### Open Questions / Blockers
*(none)*

---
*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*
