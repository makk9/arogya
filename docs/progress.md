# arogya — Session Context

> Loaded automatically at every session start. Update with `/handoff` before ending a session.
> Full decision log: `docs/decisions.md`

---

## Current Phase: B complete (items 1-7) — Phase C next

### Phase A (complete)
- [x] 1-7. Foundation shipped (see decisions.md 2026-05-11/12 entries).

### Phase B — Agent Infrastructure
- [x] 1. Vault context builder — `lib/agents/_shared/vault-context.ts`. `excludeBriefs` default-true, `includeInsights` mode, `surfaceContext`, deterministic `now` param.
- [x] 2. Per-entity serializers — 14 files in `lib/agents/_shared/serializers/` + `format.ts` + barrel.
- [x] 3. Agent error types — `lib/agents/_shared/errors.ts`. `AgentError` with discriminated `code`.
- [x] 4. Zod output schemas — `lib/agents/_shared/schemas.ts`. All agent outputs per 10.3.
- [x] 5. Synthesis agent — `lib/agents/synthesis.ts` + `app/api/chat/route.ts`. Opus 4.7, streaming, verbatim prompt, cache hit verified (3150 tokens), three-modes-from-prompt.
- [x] 6. Router — `lib/agents/router.ts` + `scripts/check-router.ts`. Haiku 4.5, direct SDK, no vault context, 3-bucket confidence. Smoke green (6/6 cases, ~1s latency per call).
- [x] 7. Citation parser — `lib/citations/{parse,remark-plugin}.ts` + `components/{citation-pill,ai-message}.tsx` + `scripts/check-citation-parser.ts`. react-markdown + custom remark plugin → inert pills with `data-*` attrs for Phase C handoff. Smoke green (10/10 cases incl. round-trip against `citationFor()`).

### Phase C — First Vertical Slice (Medication, next after B)
- [ ] 1. Medication API routes — list, create, read, update, delete, `/discontinue`
- [ ] 2. Medication form — shadcn/ui init happens here (first component); form template per 6.12
- [ ] 3. Medications list page — state list template per 6.4
- [ ] 4. Medication detail page — state entity detail template per 6.5
- [ ] 5. Inline editing + change-log entry creation
- [ ] 6. Floating Ask AI button on Medication pages
- [ ] 7. Citation pill rendering for `§ med:amlodipine` (builds on Phase B citation parser)

### Phase D — Replicate Pattern (after C)
Other state entities · All event entities · Patient profile · Insights feed (placeholder)

### Phase E — AI-Driven Flows (after D)
Extraction agent + upload pipeline + confirmation surface · Onboarding (agent + surface) · Insight generator · Auto-titling · Doctor brief

### Phase F — Polish

---

### Last Session
- 2026-05-15 — Phase B item 6 (Router) shipped. Haiku 4.5, direct SDK + prompted-JSON + Zod, defensive markdown-fence stripping, smoke green at ~1s/call. Intent enum canonicalized to `question | log | ambiguous`.
- 2026-05-16 — Doc-fix cleanup pass on design.md (4 sites: 3064 relationship phrasing, 9.3 model IDs, 10.3 + 9.3 router output enum). Stale-comment cleanup in `synthesis.ts` and `schemas.ts`.
- 2026-05-16 — **Phase B item 7 (Citation parser) shipped.** react-markdown + custom remark plugin + inert pills + tokenizer unit tests. Phase B complete.

### Next Steps
1. **Phase C item 1 — Medication API routes.** First Phase C item; pivot from agent infra to vertical-slice work. Routes: list, create, read, update, delete, `/discontinue`. Auth via `getCurrentPatient()`, Zod-validated bodies, errors via `apiError()`. Schema/queries already exist from Phase A.
2. **Phase C item 2 — Medication form + shadcn/ui init.** First component triggers shadcn/ui setup. Form template per design.md 6.12.
3. **Phase C item 7 — Citation pill integration.** Wraps the Phase B citation pill with shadcn Popover + entity preview + `View full →` navigation. Reads `data-entity-type` / `data-slug` from the Phase B pill component (no API change needed).

### Open Questions / Blockers
- **TODO before Phase C:** push `import "server-only"` to `@/lib/env` when first client component imports from `@/lib/*`. TODO comment in `vault-context.ts`.
- **Doc-fixes pending (non-blocking):** none. (2026-05-16 — all four prior fixes applied to design.md: 10.3:3214 + 3217 router output; 3064 relationship phrasing; 9.3:2395 + 2421 + 2436 model IDs; 9.3:2446 router output. Inline code comments referencing "pending doc-fix" also cleaned up.)
- **SDK workaround:** `@ai-sdk/anthropic` 3.0.x missing `cacheReadInputTokens` at top level. Smoke script reads snake_case directly. Pending upstream fix.

---
*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*
